import json
import sqlite3
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import main


class HistoryPersistenceTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.db_path = Path(self.temp_dir.name) / "history.db"
        self.connections = []

        def connect():
            connection = sqlite3.connect(self.db_path)
            connection.row_factory = sqlite3.Row
            self.connections.append(connection)
            return connection

        self.connect = connect
        self.connection_patch = patch.object(main, "get_db_connection", side_effect=connect)
        self.connection_patch.start()
        with connect() as connection:
            connection.execute(
                """
                CREATE TABLE study_history_items (
                    email TEXT NOT NULL, id TEXT NOT NULL, payload_json TEXT NOT NULL,
                    created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
                    PRIMARY KEY (email, id)
                )
                """
            )

    def tearDown(self):
        self.connection_patch.stop()
        for connection in self.connections:
            connection.close()
        self.temp_dir.cleanup()

    def test_partial_browser_sync_never_erases_unseen_server_history(self):
        email = "student@example.com"
        first = main.upsert_history_item_for_user(
            email,
            {"id": "first", "title": "First lecture", "summary": "First full guide", "createdAt": "2026-09-01T10:00:00+00:00"},
        )
        main.upsert_history_item_for_user(
            email,
            {"id": "second", "title": "Second lecture", "summary": "Second full guide", "createdAt": "2026-09-02T10:00:00+00:00"},
        )

        compact_first = main.compact_history_item(first)
        merged = main.merge_history_items_for_user(email, [compact_first])

        self.assertEqual({item["id"] for item in merged}, {"first", "second"})
        restored_first = next(item for item in merged if item["id"] == "first")
        self.assertEqual(restored_first["summary"], "First full guide")

    def test_deletion_requires_an_explicit_delete_operation(self):
        email = "student@example.com"
        main.upsert_history_item_for_user(email, {"id": "keep", "summary": "Keep me"})
        main.merge_history_items_for_user(email, [])
        self.assertIsNotNone(main.get_history_item_for_user(email, "keep"))
        self.assertTrue(main.delete_history_item_for_user(email, "keep"))
        self.assertIsNone(main.get_history_item_for_user(email, "keep"))

    def test_history_returns_more_than_the_old_twenty_four_item_cap(self):
        email = "student@example.com"
        for index in range(35):
            main.upsert_history_item_for_user(
                email,
                {
                    "id": f"lecture-{index:02d}",
                    "title": f"Lecture {index}",
                    "createdAt": f"2026-09-{(index % 28) + 1:02d}T10:00:00+00:00",
                    "updatedAt": f"2026-09-{(index % 28) + 1:02d}T10:00:00+00:00",
                },
            )

        self.assertEqual(len(main.get_history_items_for_user(email)), 35)

    def test_legacy_missing_timestamps_use_database_dates_instead_of_now(self):
        email = "student@example.com"
        with self.connect() as connection:
            connection.execute(
                "INSERT INTO study_history_items (email, id, payload_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
                (
                    email,
                    "legacy",
                    json.dumps({"id": "legacy", "title": "Legacy lecture"}),
                    "2025-01-02T10:00:00+00:00",
                    "2025-01-03T10:00:00+00:00",
                ),
            )

        item = main.get_history_item_for_user(email, "legacy")
        self.assertEqual(item["createdAt"], "2025-01-02T10:00:00+00:00")
        self.assertEqual(item["updatedAt"], "2025-01-03T10:00:00+00:00")

    def test_compact_history_reads_metadata_without_returning_large_workspace_payloads(self):
        email = "student@example.com"
        main.upsert_history_item_for_user(
            email,
            {
                "id": "large-workspace",
                "title": "Signals lecture",
                "fileName": "signals.mp4",
                "summary": "A" * 5000,
                "lectureNotes": "B" * 10000,
                "quizQuestions": [{"question": str(index)} for index in range(3)],
                "lectureSlideFileNames": ["slides.pdf"],
                "pastQuestionPaperFileNames": ["paper.pdf"],
                "createdAt": "2026-09-02T10:00:00+00:00",
                "updatedAt": "2026-09-03T10:00:00+00:00",
            },
        )

        items = main.get_compact_history_items_for_user(email)

        self.assertEqual(len(items), 1)
        self.assertEqual(items[0]["title"], "Signals lecture")
        self.assertEqual(items[0]["quizQuestionCount"], 3)
        self.assertEqual(items[0]["lectureSlideFileCount"], 1)
        self.assertEqual(items[0]["pastQuestionPaperFileCount"], 1)
        self.assertTrue(items[0]["isCompactHistoryItem"])
        self.assertLessEqual(len(items[0]["summary"]), 420)


class ChatHistoryCountTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.db_path = Path(self.temp_dir.name) / "chat-history.db"
        self.connections = []

        def connect():
            connection = sqlite3.connect(self.db_path)
            connection.row_factory = sqlite3.Row
            self.connections.append(connection)
            return connection

        self.connection_patch = patch.object(main, "get_db_connection", side_effect=connect)
        self.connection_patch.start()
        with connect() as connection:
            connection.executescript(
                """
                CREATE TABLE assistant_conversations (
                    id TEXT PRIMARY KEY, user_email TEXT NOT NULL, title TEXT NOT NULL DEFAULT '',
                    preview_text TEXT NOT NULL DEFAULT '', last_message_preview TEXT NOT NULL DEFAULT '',
                    memory_summary TEXT NOT NULL DEFAULT '', lecture_label TEXT NOT NULL DEFAULT '',
                    context_key TEXT NOT NULL DEFAULT '', search_document TEXT NOT NULL DEFAULT '',
                    message_count INTEGER NOT NULL DEFAULT 0, is_pinned INTEGER NOT NULL DEFAULT 0,
                    is_archived INTEGER NOT NULL DEFAULT 0, metadata_json TEXT NOT NULL DEFAULT '{}',
                    last_message_at TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
                );
                CREATE TABLE assistant_messages (
                    id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL, user_email TEXT NOT NULL,
                    role TEXT NOT NULL, content TEXT NOT NULL, interaction_mode TEXT NOT NULL DEFAULT 'text',
                    provider TEXT NOT NULL DEFAULT '', model TEXT NOT NULL DEFAULT '',
                    metadata_json TEXT NOT NULL DEFAULT '{}', timestamp TEXT NOT NULL
                );
                """
            )
            connection.execute(
                """INSERT INTO assistant_conversations
                   (id, user_email, title, message_count, last_message_at, created_at, updated_at)
                   VALUES (?, ?, ?, 0, ?, ?, ?)""",
                ("chat-1", "student@example.com", "Old chat", "2026-09-03", "2026-09-03", "2026-09-03"),
            )
            connection.executemany(
                """INSERT INTO assistant_messages
                   (id, conversation_id, user_email, role, content, timestamp)
                   VALUES (?, ?, ?, ?, ?, ?)""",
                [
                    ("message-1", "chat-1", "student@example.com", "user", "Question", "2026-09-03T10:00:00"),
                    ("message-2", "chat-1", "student@example.com", "assistant", "Answer", "2026-09-03T10:00:01"),
                ],
            )

    def tearDown(self):
        self.connection_patch.stop()
        for connection in self.connections:
            connection.close()
        self.temp_dir.cleanup()

    def test_list_conversations_uses_persisted_message_rows_not_stale_zero_counter(self):
        result = main.DatabaseChatHistoryStore().list_conversations(email="student@example.com")
        self.assertEqual(result["items"][0]["message_count"], 2)


if __name__ == "__main__":
    unittest.main()
