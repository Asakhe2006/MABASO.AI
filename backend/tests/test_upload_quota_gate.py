import inspect
import json
import sqlite3
import tempfile
import unittest
from contextlib import contextmanager
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from unittest.mock import patch

from fastapi import HTTPException

from backend import main


class UploadQuotaGateTests(unittest.TestCase):
    def test_upload_quota_is_reserved_before_file_read_or_extraction(self):
        source = inspect.getsource(main.extract_slide_text)
        reserve_at = source.index("consume_plan_quota(")
        read_at = source.index("await file.read()")
        pdf_extract_at = source.index("extract_slide_text_from_pdf")
        self.assertLess(reserve_at, read_at)
        self.assertLess(read_at, pdf_extract_at)
        self.assertIn('quota_error_code="UPLOAD_LIMIT_REACHED"', source)

    def test_common_document_formats_are_supported(self):
        for extension in (".docx", ".pptx", ".xlsx", ".odt", ".ods", ".odp", ".pdf", ".rtf", ".csv"):
            self.assertIn(extension, main.ALLOWED_STUDY_SOURCE_EXTENSIONS)

    def test_concurrent_upload_reservations_cannot_exceed_allowance(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            database_path = str(Path(temp_dir) / "quota.db")
            connection = sqlite3.connect(database_path)
            connection.execute(
                """CREATE TABLE billing_usage_events (
                    id TEXT PRIMARY KEY, email TEXT, plan_id TEXT, feature TEXT,
                    period_key TEXT, quantity INTEGER, metadata_json TEXT, created_at TEXT
                )"""
            )
            connection.commit()
            connection.close()

            @contextmanager
            def open_database():
                owned = sqlite3.connect(database_path, timeout=10)
                owned.row_factory = sqlite3.Row
                try:
                    yield owned
                    owned.commit()
                except Exception:
                    owned.rollback()
                    raise
                finally:
                    owned.close()

            def reserve():
                try:
                    main.consume_plan_quota(
                        email="student@example.test",
                        feature="study_chat_upload",
                        include_account_snapshot=False,
                        quota_error_code="UPLOAD_LIMIT_REACHED",
                    )
                    return "accepted"
                except HTTPException as exc:
                    return exc.detail.get("code") if isinstance(exc.detail, dict) else str(exc.detail)

            with patch.object(main, "DATABASE_BACKEND", "sqlite"), \
                    patch.object(main, "get_db_connection", side_effect=open_database), \
                    patch.object(main, "get_effective_plan_id", return_value="free"), \
                    patch.object(main, "get_plan_quota", return_value=1), \
                    patch.object(main, "record_audit_log"):
                with ThreadPoolExecutor(max_workers=3) as executor:
                    results = list(executor.map(lambda _index: reserve(), range(3)))

            self.assertEqual(results.count("accepted"), 1)
            self.assertEqual(results.count("UPLOAD_LIMIT_REACHED"), 2)
            connection = sqlite3.connect(database_path)
            stored = connection.execute("SELECT COALESCE(SUM(quantity), 0) FROM billing_usage_events").fetchone()[0]
            connection.close()
            self.assertEqual(stored, 1)

    def test_chat_upload_receipt_is_user_bound_and_matches_accepted_content(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            database_path = str(Path(temp_dir) / "receipt.db")
            connection = sqlite3.connect(database_path)
            connection.execute(
                """CREATE TABLE billing_usage_events (
                    id TEXT PRIMARY KEY, email TEXT, feature TEXT, metadata_json TEXT
                )"""
            )
            connection.execute(
                "INSERT INTO billing_usage_events (id, email, feature, metadata_json) VALUES (?, ?, ?, ?)",
                ("usage-1", "student@example.test", "study_chat_upload", json.dumps({"status": "accepted"})),
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

            with patch.object(main, "get_db_connection", side_effect=open_database), \
                    patch.object(main, "APP_SECRET", "test-only-signing-secret"):
                receipt = main.build_chat_upload_receipt(
                    email="student@example.test",
                    usage_event_id="usage-1",
                    text="Accepted notes",
                    image_url="data:image/png;base64,accepted",
                    source_kind="image",
                )
                claims = main.verify_chat_upload_receipt(
                    receipt=receipt,
                    email="student@example.test",
                    text="Accepted notes",
                    image_url="data:image/png;base64,accepted",
                )
                self.assertEqual(claims["usage_event_id"], "usage-1")
                with self.assertRaises(HTTPException):
                    main.verify_chat_upload_receipt(
                        receipt=receipt,
                        email="other@example.test",
                        text="Accepted notes",
                        image_url="data:image/png;base64,accepted",
                    )
                with self.assertRaises(HTTPException):
                    main.verify_chat_upload_receipt(
                        receipt=receipt,
                        email="student@example.test",
                        text="Changed notes",
                        image_url="data:image/png;base64,accepted",
                    )

    def test_direct_inline_chat_attachment_reserves_upload_quota_before_model_use(self):
        payload = main.LectureAssistantRequest(
            question="Describe this image",
            reference_images=["data:image/png;base64,direct-api-image"],
        )
        with patch.object(main, "consume_plan_quota", return_value={"usage_event_id": "usage-2"}) as consume:
            authorized = main.authorize_lecture_assistant_attachments(
                payload=payload,
                current_user="student@example.test",
                request=None,
            )
        consume.assert_called_once()
        self.assertEqual(consume.call_args.kwargs["feature"], "study_chat_upload")
        self.assertEqual(consume.call_args.kwargs["quota_error_code"], "UPLOAD_LIMIT_REACHED")
        self.assertEqual(authorized.reference_images, payload.reference_images)


if __name__ == "__main__":
    unittest.main()
