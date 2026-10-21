import sqlite3
import tempfile
import unittest
from contextlib import contextmanager
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

from fastapi import HTTPException

from backend import main
from backend.library_catalog import normalize_saved_link
from backend.library_storage import LibraryStorageConfig, LibraryStorageError, SupabaseLibraryStorage, get_library_storage_config


class LibraryStorageProviderTests(unittest.TestCase):
    def test_library_upload_timeout_does_not_inherit_short_database_timeout(self):
        with patch.dict(
            "backend.library_storage.os.environ",
            {"SUPABASE_REQUEST_TIMEOUT_SECONDS": "12"},
            clear=True,
        ):
            self.assertEqual(get_library_storage_config().timeout_seconds, 120)

    def test_library_storage_accepts_new_supabase_secret_key_name(self):
        with patch.dict(
            "backend.library_storage.os.environ",
            {
                "SUPABASE_PROJECT_URL": "https://project.supabase.co",
                "SUPABASE_SECRET_KEY": "sb_secret_backend_only",
            },
            clear=True,
        ):
            config = get_library_storage_config()
        self.assertTrue(config.configured)
        self.assertEqual(config.base_url, "https://project.supabase.co")
        self.assertEqual(config.service_key, "sb_secret_backend_only")

    def test_new_supabase_secret_key_is_not_sent_as_a_bearer_jwt(self):
        storage = SupabaseLibraryStorage(LibraryStorageConfig(
            base_url="https://project.supabase.co",
            service_key="sb_secret_backend_only",
            bucket="mabaso-library",
            timeout_seconds=5,
            auto_create_bucket=False,
            bucket_file_size_limit=50 * 1024 * 1024,
        ))
        headers = storage._headers()
        self.assertEqual(headers["apikey"], "sb_secret_backend_only")
        self.assertNotIn("Authorization", headers)

    def test_legacy_service_role_jwt_remains_a_bearer_token(self):
        storage = SupabaseLibraryStorage(LibraryStorageConfig(
            base_url="https://project.supabase.co",
            service_key="eyJlegacy-service-role",
            bucket="mabaso-library",
            timeout_seconds=5,
            auto_create_bucket=False,
            bucket_file_size_limit=50 * 1024 * 1024,
        ))
        headers = storage._headers()
        self.assertEqual(headers["Authorization"], "Bearer eyJlegacy-service-role")

    def test_missing_bucket_is_created_private_then_upload_is_retried(self):
        config = LibraryStorageConfig(
            base_url="https://project.supabase.co",
            service_key="service-role-test-value",
            bucket="mabaso-library",
            timeout_seconds=5,
            auto_create_bucket=True,
            bucket_file_size_limit=50 * 1024 * 1024,
        )
        storage = SupabaseLibraryStorage(config)
        missing_upload = MagicMock(status_code=404)
        successful_upload = MagicMock(status_code=200)
        missing_bucket = MagicMock(status_code=404)
        created_bucket = MagicMock(status_code=200)

        with (
            patch("backend.library_storage.requests.get", return_value=missing_bucket) as get_request,
            patch(
                "backend.library_storage.requests.post",
                side_effect=[missing_upload, created_bucket, successful_upload],
            ) as post_request,
        ):
            storage.put("student/file.pdf", b"pdf", "application/pdf")

        get_request.assert_called_once()
        self.assertEqual(post_request.call_count, 3)
        create_call = post_request.call_args_list[1]
        self.assertEqual(create_call.kwargs["json"]["id"], "mabaso-library")
        self.assertFalse(create_call.kwargs["json"]["public"])
        self.assertEqual(create_call.kwargs["json"]["file_size_limit"], 50 * 1024 * 1024)

    def test_missing_bucket_is_not_created_without_explicit_opt_in(self):
        config = LibraryStorageConfig(
            base_url="https://project.supabase.co",
            service_key="service-role-test-value",
            bucket="mabaso-library",
            timeout_seconds=5,
            auto_create_bucket=False,
            bucket_file_size_limit=50 * 1024 * 1024,
        )
        storage = SupabaseLibraryStorage(config)
        missing_upload = MagicMock(status_code=404)
        missing_upload.json.return_value = {"message": "Bucket not found"}
        with patch("backend.library_storage.requests.post", return_value=missing_upload) as post_request:
            with self.assertRaises(LibraryStorageError):
                storage.put("student/file.pdf", b"pdf", "application/pdf")
        post_request.assert_called_once()

    def test_concurrent_bucket_creation_is_idempotent(self):
        config = LibraryStorageConfig(
            base_url="https://project.supabase.co",
            service_key="service-role-test-value",
            bucket="mabaso-library",
            timeout_seconds=5,
            auto_create_bucket=True,
            bucket_file_size_limit=50 * 1024 * 1024,
        )
        storage = SupabaseLibraryStorage(config)
        missing_bucket = MagicMock(status_code=404)
        existing_bucket = MagicMock(status_code=200)
        already_created = MagicMock(status_code=409)
        already_created.json.return_value = {"message": "Bucket already exists"}
        with (
            patch("backend.library_storage.requests.get", side_effect=[missing_bucket, existing_bucket]) as get_request,
            patch("backend.library_storage.requests.post", return_value=already_created),
        ):
            storage.ensure_private_bucket()
        self.assertEqual(get_request.call_count, 2)


class PersonalLibraryTests(unittest.TestCase):
    def test_storage_capacities_follow_the_effective_ai_plan(self):
        self.assertEqual(main.get_library_storage_limit("free"), 200 * 1024 * 1024)
        self.assertEqual(main.get_library_storage_limit("pro_student_monthly"), 500 * 1024 * 1024)
        self.assertEqual(main.get_library_storage_limit("premium_student_annual"), 2 * 1024 * 1024 * 1024)

    def test_storage_addon_catalog_is_visible_but_cannot_fake_checkout(self):
        package_ids = [package["id"] for package in main.LIBRARY_STORAGE_ADDON_CATALOG]
        self.assertEqual(package_ids, ["storage_mini", "storage_plus", "storage_max", "storage_ultra"])
        self.assertEqual([package["amount_zar"] for package in main.LIBRARY_STORAGE_ADDON_CATALOG], [23, 39, 69, 119])

    def test_verified_billing_payment_grants_storage_without_payment_request_dependency(self):
        connection = sqlite3.connect(":memory:")
        connection.row_factory = sqlite3.Row
        connection.executescript(
            """
            CREATE TABLE billing_payments (
                plan_id TEXT, amount_zar TEXT, provider_payment_id TEXT, payment_status TEXT,
                email TEXT, paid_at TEXT, created_at TEXT
            );
            INSERT INTO billing_payments VALUES (
                'storage_plus', '39.00', 'PF-STORAGE-1', 'PAID',
                'student@example.test', '2099-10-19T10:00:00+00:00', '2099-10-19T10:00:00+00:00'
            );
            """
        )

        @contextmanager
        def open_database():
            yield connection

        with patch.object(main, "get_db_connection", side_effect=open_database):
            addon = main.get_active_library_storage_addon("student@example.test")
        self.assertEqual(addon["id"], "storage_plus")
        self.assertEqual(addon["capacity_bytes"], 500 * 1024 * 1024)

    def test_missing_addon_billing_schema_does_not_break_base_library(self):
        connection = sqlite3.connect(":memory:")
        connection.row_factory = sqlite3.Row

        @contextmanager
        def open_database():
            yield connection

        with patch.object(main, "get_db_connection", side_effect=open_database):
            self.assertIsNone(main.get_active_library_storage_addon("student@example.test"))

    def test_library_accepts_audio_but_rejects_video_binaries(self):
        main.ensure_allowed_library_upload("lecture.wav", "audio/wav")
        main.ensure_allowed_library_upload("notes.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
        with self.assertRaises(HTTPException):
            main.ensure_allowed_library_upload("lecture.mp4", "video/mp4")

    def test_saved_links_strip_fragments_and_reject_private_or_secret_urls(self):
        normalized, domain = normalize_saved_link("https://www.dut.ac.za/study/?faculty=engineering#fees")
        self.assertEqual(domain, "www.dut.ac.za")
        self.assertEqual(normalized, "https://www.dut.ac.za/study/?faculty=engineering")
        for unsafe in (
            "http://127.0.0.1/admin",
            "http://localhost/secrets",
            "https://example.test/callback?access_token=secret",
            "https://user:password@example.test/private",
        ):
            with self.assertRaises(ValueError):
                normalize_saved_link(unsafe)

    def test_existing_library_reference_is_not_charged_as_a_new_upload(self):
        payload = main.LectureAssistantRequest(
            question="Summarise my saved notes",
            reference_attachments=[{"library_file_id": "owned-file"}],
        )
        owned_file = {
            "id": "owned-file",
            "owner_email": "student@example.test",
            "object_key": "student/owned-file.txt",
            "original_name": "notes.txt",
            "content_type": "text/plain",
            "size_bytes": 15,
            "checksum_sha256": "checksum",
            "category": "document",
            "source_type": "study_chat_upload",
            "extracted_text": "Trusted cached notes",
            "status": "ready",
            "created_at": "2026-10-14T00:00:00Z",
            "updated_at": "2026-10-14T00:00:00Z",
            "deleted_at": "",
        }
        with (
            patch.object(main, "get_owned_library_file", return_value=owned_file),
            patch.object(main.library_object_storage, "get", return_value=b"Trusted cached notes") as storage_get,
            patch.object(main, "consume_plan_quota") as consume_quota,
        ):
            resolved = main.authorize_lecture_assistant_attachments(
                payload=payload,
                current_user="student@example.test",
                request=None,
            )
        consume_quota.assert_not_called()
        storage_get.assert_not_called()
        self.assertIn("Trusted cached notes", resolved.lecture_notes)
        self.assertEqual(resolved.reference_attachments, [])

    def test_failed_storage_upload_does_not_delete_an_object_that_was_never_created(self):
        storage = MagicMock()
        storage.configured = True
        storage.put.side_effect = main.LibraryStorageError("upload rejected", status_code=404)
        with (
            patch.object(main, "library_object_storage", storage),
            patch.object(main, "release_library_storage_reservation") as release,
        ):
            with self.assertRaises(HTTPException) as raised:
                main.commit_library_file(
                    email="student@example.test",
                    reservation_id="reservation-1",
                    filename="notes.pdf",
                    content_type="application/pdf",
                    content=b"pdf bytes",
                    checksum="checksum",
                )
        self.assertEqual(raised.exception.status_code, 503)
        self.assertEqual(raised.exception.detail["code"], "LIBRARY_STORAGE_UNAVAILABLE")
        storage.delete.assert_not_called()
        release.assert_called_once_with("student@example.test", "reservation-1")

    def test_profile_personalization_is_opt_in_and_user_scoped(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            database_path = str(Path(temp_dir) / "personalization.db")
            connection = sqlite3.connect(database_path)
            connection.executescript(
                """
                CREATE TABLE collaboration_profiles (
                    email TEXT PRIMARY KEY, display_name TEXT, institution TEXT, course TEXT,
                    study_year TEXT, subjects_json TEXT, ai_personalization_enabled INTEGER
                );
                INSERT INTO collaboration_profiles VALUES
                    ('enabled@example.test', 'Asakhe', 'DUT', 'Engineering', 'Second year', '["Signals"]', 1),
                    ('disabled@example.test', 'Private', 'Hidden University', 'Law', 'First year', '["Contracts"]', 0);
                """
            )
            connection.commit()
            connection.close()

            @contextmanager
            def open_database():
                owned = sqlite3.connect(database_path)
                owned.row_factory = sqlite3.Row
                try:
                    yield owned
                finally:
                    owned.close()

            with patch.object(main, "get_db_connection", side_effect=open_database):
                enabled = main.get_chat_personalization_context("enabled@example.test")
                disabled = main.get_chat_personalization_context("disabled@example.test")
            self.assertIn("Preferred name: Asakhe", enabled)
            self.assertIn("Institution: DUT", enabled)
            self.assertEqual(disabled, "")

    def test_cross_chat_memory_is_bounded_relevant_and_user_scoped(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            database_path = str(Path(temp_dir) / "memory.db")
            connection = sqlite3.connect(database_path)
            connection.executescript(
                """
                CREATE TABLE assistant_conversations (
                    id TEXT PRIMARY KEY, user_email TEXT, title TEXT, memory_summary TEXT,
                    updated_at TEXT, is_archived INTEGER
                );
                INSERT INTO assistant_conversations VALUES
                    ('current', 'student@example.test', 'Current', 'Current summary', '2026-10-14T10:00:00Z', 0),
                    ('signals', 'student@example.test', 'Signals project', 'The student is studying Fourier signals.', '2026-10-13T10:00:00Z', 0),
                    ('other-user', 'other@example.test', 'Signals secret', 'Private other-user signals.', '2026-10-14T11:00:00Z', 0),
                    ('irrelevant', 'student@example.test', 'History', 'The student discussed poetry.', '2026-10-12T10:00:00Z', 0);
                """
            )
            connection.commit()
            connection.close()

            @contextmanager
            def open_database():
                owned = sqlite3.connect(database_path)
                owned.row_factory = sqlite3.Row
                try:
                    yield owned
                finally:
                    owned.close()

            with patch.object(main, "get_db_connection", side_effect=open_database):
                context = main.get_relevant_cross_chat_context(
                    "student@example.test", "current", "Help with Fourier signals",
                )
            self.assertIn("Signals project", context)
            self.assertNotIn("other-user", context)
            self.assertNotIn("poetry", context)


class PodcastLibraryPersistenceTests(unittest.IsolatedAsyncioTestCase):
    async def test_completed_podcast_is_saved_once_as_a_library_recording(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            podcast_path = Path(temp_dir) / "full-podcast.mp3"
            podcast_path.write_bytes(b"generated podcast audio")
            package = {
                "podcast_title": "Signals revision",
                "podcast_script": "A cached podcast transcript.",
                "_podcast_download_file": str(podcast_path),
            }
            storage = MagicMock()
            storage.configured = True
            main.jobs["podcast-library-test"] = {
                "owner_email": "student@example.test",
                "created_at": "2026-10-14T00:00:00+00:00",
            }
            with (
                patch.object(main, "generate_podcast_package", new=AsyncMock(return_value=package)),
                patch.object(main, "library_object_storage", storage),
                patch.object(main, "reserve_library_storage", return_value={"existing": None, "reservation_id": "reservation-1"}),
                patch.object(main, "commit_library_file", return_value={"id": "library-podcast", "category": "audio"}) as commit,
                patch.object(main, "update_job") as update_job,
                patch.object(main, "record_audit_log"),
            ):
                await main.run_podcast_job(
                    "podcast-library-test", "Summary", "Transcript", "Notes", "Slides", "Questions",
                    2, None, 8, "English",
                )
            commit.assert_called_once()
            self.assertEqual(commit.call_args.kwargs["source_type"], "generated_podcast")
            self.assertEqual(commit.call_args.kwargs["content_type"], "audio/mpeg")
            completed = [call for call in update_job.call_args_list if call.kwargs.get("status") == "completed"]
            self.assertEqual(len(completed), 1)
            self.assertEqual(completed[0].kwargs["library_file"]["id"], "library-podcast")
            self.assertEqual(completed[0].kwargs["library_save_status"], "saved")
            main.jobs.pop("podcast-library-test", None)


class StudyGuideLibraryPersistenceTests(unittest.IsolatedAsyncioTestCase):
    async def test_generated_study_guide_is_saved_before_remaining_tools_finish(self):
        job_id = main.create_job("study_guide", "student@example.test")
        with (
            patch.object(main, "generate_study_guide", new=AsyncMock(return_value=("# Control Systems\n\nA useful guide.", False))),
            patch.object(main, "save_generated_artifact_to_library", return_value=({"id": "library-guide"}, "saved")) as save,
            patch.object(main, "generate_study_formula_asset", new=AsyncMock(return_value={})),
            patch.object(main, "resolve_study_guide_visuals", new=AsyncMock(return_value=[])),
            patch.object(main, "record_audit_log"),
        ):
            await main.run_summary_job(
                job_id, "", "Notes", "", "", "English", [],
                "student@example.test", "Control Systems",
            )

        save.assert_called_once()
        self.assertEqual(save.call_args.kwargs["source_type"], "generated_study_guide")
        self.assertEqual(save.call_args.kwargs["content_type"], "text/markdown")
        self.assertEqual(main.jobs[job_id]["library_file"]["id"], "library-guide")
        self.assertEqual(main.jobs[job_id]["library_save_status"], "saved")
        main.jobs.pop(job_id, None)


if __name__ == "__main__":
    unittest.main()
