import sqlite3
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import main


class CollaborationRoomFlowTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.db_path = Path(self.temp_dir.name) / "collaboration.db"
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
                CREATE TABLE collaboration_rooms (
                    id TEXT PRIMARY KEY, owner_email TEXT NOT NULL, title TEXT NOT NULL,
                    transcript TEXT NOT NULL, summary TEXT NOT NULL, formula TEXT NOT NULL,
                    example TEXT NOT NULL, lecture_notes TEXT NOT NULL, lecture_slides TEXT NOT NULL,
                    shared_notes TEXT NOT NULL, study_images_json TEXT NOT NULL DEFAULT '[]',
                    board_images_json TEXT NOT NULL DEFAULT '[]', flashcards_json TEXT NOT NULL,
                    quiz_questions_json TEXT NOT NULL, active_tab TEXT NOT NULL,
                    test_visibility TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
                );
                CREATE TABLE collaboration_room_members (
                    room_id TEXT NOT NULL, email TEXT NOT NULL, role TEXT NOT NULL,
                    created_at TEXT NOT NULL, PRIMARY KEY (room_id, email)
                );
                CREATE TABLE collaboration_room_messages (
                    id TEXT PRIMARY KEY, room_id TEXT NOT NULL, author_email TEXT NOT NULL,
                    content TEXT NOT NULL, created_at TEXT NOT NULL
                );
                CREATE TABLE collaboration_room_answers (
                    room_id TEXT NOT NULL, question_number TEXT NOT NULL, author_email TEXT NOT NULL,
                    answer_text TEXT NOT NULL, updated_at TEXT NOT NULL,
                    PRIMARY KEY (room_id, question_number, author_email)
                );
                CREATE TABLE collaboration_materials (
                    id TEXT PRIMARY KEY, room_id TEXT NOT NULL, owner_email TEXT NOT NULL,
                    title TEXT NOT NULL, material_type TEXT NOT NULL, description TEXT NOT NULL DEFAULT '',
                    source_json TEXT NOT NULL DEFAULT '{}', visibility TEXT NOT NULL DEFAULT 'room',
                    created_at TEXT NOT NULL, updated_at TEXT NOT NULL
                );
                CREATE TABLE collaboration_board_items (
                    id TEXT PRIMARY KEY, room_id TEXT NOT NULL, owner_email TEXT NOT NULL,
                    item_type TEXT NOT NULL, title TEXT NOT NULL DEFAULT '', content TEXT NOT NULL DEFAULT '',
                    checklist_json TEXT NOT NULL DEFAULT '[]', due_at TEXT NOT NULL DEFAULT '',
                    material_id TEXT NOT NULL DEFAULT '', pinned INTEGER NOT NULL DEFAULT 0,
                    created_at TEXT NOT NULL, updated_at TEXT NOT NULL
                );
                CREATE TABLE collaboration_profiles (
                    email TEXT PRIMARY KEY, public_id TEXT NOT NULL DEFAULT '', display_name TEXT NOT NULL DEFAULT '', bio TEXT NOT NULL DEFAULT '',
                    institution TEXT NOT NULL DEFAULT '', course TEXT NOT NULL DEFAULT '',
                    study_year TEXT NOT NULL DEFAULT '', subjects_json TEXT NOT NULL DEFAULT '[]',
                    can_help_json TEXT NOT NULL DEFAULT '[]', needs_help_json TEXT NOT NULL DEFAULT '[]',
                    discoverable INTEGER NOT NULL DEFAULT 0, show_institution INTEGER NOT NULL DEFAULT 0,
                    allow_requests INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
                );
                """
            )

    def tearDown(self):
        self.connection_patch.stop()
        for connection in self.connections:
            connection.close()
        self.temp_dir.cleanup()

    async def test_room_chat_material_board_and_profile_are_persisted(self):
        owner = "owner@example.com"
        room_result = await main.create_collaboration_room(
            main.CollaborationRoomCreateRequest(title="Engineering Ethics"),
            current_user=owner,
        )
        room_id = room_result["room"]["id"]
        self.assertEqual(room_result["room"]["title"], "Engineering Ethics")

        message_result = await main.send_collaboration_message(
            room_id,
            main.CollaborationMessageRequest(content="Let us revise chapter three."),
            current_user=owner,
        )
        self.assertEqual(message_result["room"]["messages"][-1]["content"], "Let us revise chapter three.")

        material_result = await main.create_collaboration_material_item(
            room_id,
            main.CollaborationMaterialCreateRequest(
                title="Ethics Study Guide",
                material_type="study_guide",
                source={"kind": "history", "snapshot": {"summary": "Shared guide content"}},
            ),
            current_user=owner,
        )
        self.assertEqual(material_result["item"]["source"]["snapshot"]["summary"], "Shared guide content")

        board_result = await main.create_collaboration_board_item(
            room_id,
            main.CollaborationBoardItemCreateRequest(
                item_type="task",
                title="Revision tasks",
                checklist=["Summarise chapter 3", "Prepare examples"],
            ),
            current_user=owner,
        )
        self.assertEqual(board_result["item"]["checklist"], ["Summarise chapter 3", "Prepare examples"])

        profile_result = await main.save_my_collaboration_profile(
            main.CollaborationProfileRequest(
                display_name="Student One",
                course="Electrical Engineering",
                subjects=["Communication Systems"],
                discoverable=True,
            ),
            current_user=owner,
        )
        self.assertEqual(profile_result["profile"]["display_name"], "Student One")

        student_profile = await main.save_my_collaboration_profile(
            main.CollaborationProfileRequest(
                display_name="Student Two",
                course="Electrical Engineering",
                subjects=["Communication Systems", "MATLAB"],
                can_help=["MATLAB"],
                discoverable=True,
                allow_requests=True,
            ),
            current_user="student2@example.com",
        )
        discovery = await main.discover_collaboration_profiles("MATLAB", current_user=owner)
        self.assertEqual(discovery["profiles"][0]["public_id"], student_profile["profile"]["public_id"])
        self.assertTrue(discovery["profiles"][0]["match_reasons"])

        invite_result = await main.invite_discovered_profile_to_room(
            room_id,
            student_profile["profile"]["public_id"],
            current_user=owner,
        )
        self.assertEqual(invite_result["room"]["members"][-1]["email"], "student2@example.com")

        reopened = await main.get_collaboration_room(room_id, current_user=owner)
        self.assertEqual(len(reopened["room"]["messages"]), 1)
        self.assertEqual(len(reopened["room"]["materials"]), 1)
        self.assertEqual(len(reopened["room"]["board_items"]), 1)


if __name__ == "__main__":
    unittest.main()
