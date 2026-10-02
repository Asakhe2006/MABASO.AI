import sqlite3
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import main


class AiChatConversationLimitTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.db_path = Path(self.temp_dir.name) / "chat-limits.db"
        self.connections = []

        def connect():
            connection = sqlite3.connect(self.db_path, timeout=5)
            connection.row_factory = sqlite3.Row
            self.connections.append(connection)
            return connection

        self.connection_patch = patch.object(main, "get_db_connection", side_effect=connect)
        self.history_patch = patch.object(main, "count_persisted_conversation_user_messages", return_value=0)
        self.plan_patch = patch.object(main, "get_effective_plan_id", return_value="free")
        self.connection_patch.start()
        self.history_patch.start()
        self.plan_patch.start()
        with connect() as connection:
            connection.executescript(
                """
                CREATE TABLE assistant_conversation_usage (
                    user_email TEXT NOT NULL,
                    conversation_id TEXT NOT NULL,
                    used_count INTEGER NOT NULL DEFAULT 0,
                    pending_count INTEGER NOT NULL DEFAULT 0,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    PRIMARY KEY (user_email, conversation_id)
                );
                CREATE TABLE assistant_conversation_turn_reservations (
                    id TEXT PRIMARY KEY,
                    user_email TEXT NOT NULL,
                    conversation_id TEXT NOT NULL,
                    status TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );
                """
            )

    def tearDown(self):
        self.plan_patch.stop()
        self.history_patch.stop()
        self.connection_patch.stop()
        for connection in self.connections:
            connection.close()
        self.temp_dir.cleanup()

    def test_free_chat_locks_at_five_and_pending_request_prevents_race(self):
        email = "student@example.com"
        conversation_id = "chat-a"
        for index in range(4):
            reservation_id, _ = main.reserve_ai_chat_conversation_turn(
                email=email,
                conversation_id=conversation_id,
                client_request_id=f"request-{index}",
                plan_id="free",
            )
            self.assertTrue(reservation_id)
            usage = main.finalize_ai_chat_conversation_turn(reservation_id, completed=True)
            self.assertEqual(usage["used"], index + 1)

        fifth_reservation, fifth_pending = main.reserve_ai_chat_conversation_turn(
            email=email,
            conversation_id=conversation_id,
            client_request_id="request-5",
            plan_id="free",
        )
        self.assertTrue(fifth_reservation)
        self.assertEqual(fifth_pending["pending"], 1)

        raced_reservation, blocked = main.reserve_ai_chat_conversation_turn(
            email=email,
            conversation_id=conversation_id,
            client_request_id="request-6",
            plan_id="free",
        )
        self.assertEqual(raced_reservation, "")
        self.assertEqual(blocked["used"], 4)
        self.assertEqual(blocked["pending"], 1)

        completed = main.finalize_ai_chat_conversation_turn(fifth_reservation, completed=True)
        self.assertEqual(completed["used"], 5)
        self.assertTrue(completed["limit_reached"])
        after_limit, usage = main.reserve_ai_chat_conversation_turn(
            email=email,
            conversation_id=conversation_id,
            client_request_id="request-7",
            plan_id="free",
        )
        self.assertEqual(after_limit, "")
        self.assertTrue(usage["limit_reached"])

    def test_new_conversation_has_its_own_limit_without_changing_daily_quota_logic(self):
        reservation_id, usage = main.reserve_ai_chat_conversation_turn(
            email="student@example.com",
            conversation_id="chat-b",
            client_request_id="new-chat-request",
            plan_id="free",
        )
        self.assertTrue(reservation_id)
        self.assertEqual(usage["limit"], 5)
        self.assertEqual(usage["used"], 0)
        source = Path(main.__file__).read_text(encoding="utf-8")
        self.assertIn('feature="study_chat"', source)
        self.assertIn('"study_chat": get_int_env("FREE_PLAN_AI_CHAT_MESSAGES_PER_DAY", 15)', source)


if __name__ == "__main__":
    unittest.main()
