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


if __name__ == "__main__":
    unittest.main()
