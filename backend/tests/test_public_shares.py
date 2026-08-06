import sqlite3
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import main


class PublicShareTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.db_path = Path(self.temp_dir.name) / "shares.db"
        self.connections = []
        connection = sqlite3.connect(self.db_path)
        self.connections.append(connection)
        with connection:
            connection.execute(
                """CREATE TABLE public_shares (
                    id TEXT PRIMARY KEY, token_hash TEXT NOT NULL UNIQUE,
                    owner_email TEXT NOT NULL, resource_type TEXT NOT NULL,
                    resource_id TEXT NOT NULL, title TEXT NOT NULL,
                    snapshot_json TEXT NOT NULL, expires_at TEXT NOT NULL,
                    revoked_at TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
                )"""
            )

        def connect():
            connection = sqlite3.connect(self.db_path)
            connection.row_factory = sqlite3.Row
            self.connections.append(connection)
            return connection

        self.connection_patch = patch.object(main, "get_db_connection", side_effect=connect)
        self.connection_patch.start()

    def open_connection(self):
        connection = sqlite3.connect(self.db_path)
        self.connections.append(connection)
        return connection

    def tearDown(self):
        self.connection_patch.stop()
        for connection in self.connections:
            connection.close()
        self.temp_dir.cleanup()

    def test_material_snapshot_excludes_private_source_data(self):
        snapshot = main.build_public_material_snapshot({
            "title": "Control Systems",
            "summary": "A safe summary",
            "ownerEmail": "private@example.com",
            "lectureNoteSources": [{"path": "private.pdf"}],
            "studyGuideDocumentHtml": {"definition": "<p onclick='bad()'>Safe</p><script>bad()</script>"},
        })
        self.assertNotIn("ownerEmail", snapshot)
        self.assertNotIn("lectureNoteSources", snapshot)
        self.assertNotIn("script", snapshot["studyGuideDocumentHtml"]["definition"].lower())
        self.assertNotIn("onclick", snapshot["studyGuideDocumentHtml"]["definition"].lower())

    def test_material_title_uses_lecture_topic_not_generation_instruction(self):
        normalized = main.normalize_history_item_payload({
            "title": "Generate a detailed guide with diagrams",
            "summary": "**LECTURE TOPIC**\nControl Systems\n\n**SHORT SUMMARY**\nFeedback controls output.",
        })
        self.assertEqual(normalized["title"], "Control Systems")

    def test_share_stores_hash_and_revocation_blocks_old_token(self):
        share = main.create_public_share("owner@example.com", "material", "material-1", "Topic", {"title": "Topic"})
        with self.open_connection() as connection:
            stored_hash = connection.execute("SELECT token_hash FROM public_shares WHERE id = ?", (share["id"],)).fetchone()[0]
            self.assertNotEqual(stored_hash, share["token"])
        self.assertEqual(main.get_public_share_by_token(share["token"], "material")["title"], "Topic")
        with self.open_connection() as connection:
            connection.execute("UPDATE public_shares SET revoked_at = '2026-01-01T00:00:00+00:00' WHERE id = ?", (share["id"],))
        self.assertIsNone(main.get_public_share_by_token(share["token"], "material"))

    def test_regeneration_invalidates_previous_link(self):
        first = main.create_public_share("owner@example.com", "chat", "chat-1", "First", {"title": "First", "messages": []})
        second = main.create_public_share("owner@example.com", "chat", "chat-1", "Second", {"title": "Second", "messages": []})
        self.assertIsNone(main.get_public_share_by_token(first["token"], "chat"))
        self.assertEqual(main.get_public_share_by_token(second["token"], "chat")["title"], "Second")

    def test_selected_chat_snapshot_has_only_user_and_assistant_messages(self):
        snapshot = main.build_public_chat_snapshot({
            "conversation": {"title": "Calculus"},
            "messages": [
                {"id": "hidden", "role": "system", "content": "private prompt"},
                {"id": "one", "role": "user", "content": "Differentiate x squared"},
                {"id": "two", "role": "assistant", "content": "The derivative is 2x."},
            ],
        }, ["two"])
        self.assertEqual(snapshot["messages"], [{"id": "two", "role": "assistant", "content": "The derivative is 2x."}])


if __name__ == "__main__":
    unittest.main()
