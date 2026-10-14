import sqlite3
import tempfile
import unittest
from contextlib import contextmanager
from pathlib import Path
from unittest.mock import patch

from fastapi import HTTPException

from backend import main


class PersonalLibraryTests(unittest.TestCase):
    def test_storage_capacities_follow_the_effective_ai_plan(self):
        self.assertEqual(main.get_library_storage_limit("free"), 200 * 1024 * 1024)
        self.assertEqual(main.get_library_storage_limit("pro_student_monthly"), 500 * 1024 * 1024)
        self.assertEqual(main.get_library_storage_limit("premium_student_annual"), 2 * 1024 * 1024 * 1024)

    def test_library_accepts_audio_but_rejects_video_binaries(self):
        main.ensure_allowed_library_upload("lecture.wav", "audio/wav")
        main.ensure_allowed_library_upload("notes.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
        with self.assertRaises(HTTPException):
            main.ensure_allowed_library_upload("lecture.mp4", "video/mp4")

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


if __name__ == "__main__":
    unittest.main()
