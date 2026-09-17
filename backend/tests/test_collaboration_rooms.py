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
                    content TEXT NOT NULL, message_type TEXT NOT NULL DEFAULT 'text',
                    media_id TEXT NOT NULL DEFAULT '', duration_seconds INTEGER NOT NULL DEFAULT 0,
                    created_at TEXT NOT NULL
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
                    phone TEXT NOT NULL DEFAULT '',
                    discoverable INTEGER NOT NULL DEFAULT 0, show_institution INTEGER NOT NULL DEFAULT 0,
                    show_email INTEGER NOT NULL DEFAULT 0, show_phone INTEGER NOT NULL DEFAULT 0,
                    allow_requests INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
                );
                CREATE TABLE collaboration_presence (
                    email TEXT PRIMARY KEY, last_seen_at TEXT NOT NULL
                );
                CREATE TABLE collaboration_room_invites (
                    id TEXT PRIMARY KEY, token_hash TEXT NOT NULL UNIQUE, room_id TEXT NOT NULL,
                    inviter_email TEXT NOT NULL, invited_email TEXT NOT NULL, status TEXT NOT NULL,
                    email_status TEXT NOT NULL, email_error TEXT NOT NULL, created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );
                CREATE TABLE collaboration_notifications (
                    id TEXT PRIMARY KEY, recipient_email TEXT NOT NULL, actor_email TEXT NOT NULL,
                    room_id TEXT NOT NULL, notification_type TEXT NOT NULL, title TEXT NOT NULL,
                    message TEXT NOT NULL, read_at TEXT NOT NULL, created_at TEXT NOT NULL
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
        room_background_tasks = main.BackgroundTasks()
        room_result = await main.create_collaboration_room(
            main.CollaborationRoomCreateRequest(title="Engineering Ethics"),
            background_tasks=room_background_tasks,
            current_user=owner,
        )
        room_id = room_result["room"]["id"]
        self.assertEqual(room_result["room"]["title"], "Engineering Ethics")

        message_result = await main.send_collaboration_message(
            room_id,
            main.CollaborationMessageRequest(content="Let us revise chapter three."),
            current_user=owner,
        )
        self.assertEqual(message_result["message"]["content"], "Let us revise chapter three.")

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

        checklist_only_result = await main.create_collaboration_board_item(
            room_id,
            main.CollaborationBoardItemCreateRequest(
                item_type="task",
                checklist=["Review the final answer"],
            ),
            current_user=owner,
        )
        self.assertEqual(checklist_only_result["item"]["checklist"], ["Review the final answer"])

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
                phone="+27 63 000 0000",
                discoverable=True,
                show_email=True,
                show_phone=True,
                allow_requests=True,
            ),
            current_user="student2@example.com",
        )
        await main.update_collaboration_presence(current_user="student2@example.com")
        discovery = await main.discover_collaboration_profiles("MATLAB", current_user=owner)
        self.assertEqual(discovery["profiles"][0]["public_id"], student_profile["profile"]["public_id"])
        self.assertTrue(discovery["profiles"][0]["match_reasons"])
        self.assertTrue(discovery["profiles"][0]["is_online"])
        self.assertEqual(discovery["profiles"][0]["email"], "student2@example.com")
        self.assertEqual(discovery["profiles"][0]["phone"], "+27 63 000 0000")

        invite_background_tasks = main.BackgroundTasks()
        invite_result = await main.invite_discovered_profile_to_room(
            room_id,
            student_profile["profile"]["public_id"],
            background_tasks=invite_background_tasks,
            current_user=owner,
        )
        self.assertIn("student2@example.com", {member["email"] for member in invite_result["members"]})
        self.assertTrue(invite_result["invited"])
        self.assertEqual(len(invite_background_tasks.tasks), 1)
        with main.get_db_connection() as connection:
            invitation = connection.execute("SELECT * FROM collaboration_room_invites WHERE id = ?", (invite_result["invitation_id"],)).fetchone()
            notification = connection.execute("SELECT * FROM collaboration_notifications WHERE recipient_email = ?", ("student2@example.com",)).fetchone()
        self.assertIsNotNone(invitation)
        self.assertIsNotNone(notification)

        discovery_after_invite = await main.discover_collaboration_profiles("MATLAB", current_user=owner)
        self.assertTrue(discovery_after_invite["profiles"][0]["has_collaborated"])

        with self.assertRaises(main.HTTPException):
            await main.accept_collaboration_invitation(
                room_id,
                request=None,
                current_user="not-invited@example.com",
            )

        member_message = await main.send_collaboration_message(
            room_id,
            main.CollaborationMessageRequest(
                content="I have added my revision task.",
                reply_to_id=message_result["message"]["id"],
            ),
            current_user="student2@example.com",
        )
        self.assertEqual(member_message["message"]["author_email"], "student2@example.com")
        self.assertEqual(member_message["message"]["reply_preview"]["content"], "Let us revise chapter three.")

        member_board_item = await main.create_collaboration_board_item(
            room_id,
            main.CollaborationBoardItemCreateRequest(item_type="note", content="Member revision note"),
            current_user="student2@example.com",
        )
        self.assertEqual(member_board_item["item"]["owner_email"], "student2@example.com")
        updated_board_item = await main.update_collaboration_board_item(
            room_id,
            member_board_item["item"]["id"],
            main.CollaborationBoardItemCreateRequest(
                item_type="note",
                title="Updated together",
                content="This edit is saved for the next device.",
            ),
            current_user="student2@example.com",
        )
        self.assertEqual(updated_board_item["item"]["title"], "Updated together")

        with self.assertRaises(main.HTTPException):
            await main.get_collaboration_room(room_id, current_user="outsider@example.com")

        reopened = await main.get_collaboration_room(room_id, current_user=owner)
        self.assertEqual(len(reopened["room"]["messages"]), 2)
        self.assertEqual(reopened["room"]["messages"][1]["reply_to_id"], message_result["message"]["id"])
        self.assertEqual(len(reopened["room"]["materials"]), 1)
        self.assertEqual(len(reopened["room"]["board_items"]), 3)

        message_page = await main.list_collaboration_messages(
            room_id,
            before="",
            limit=50,
            current_user=owner,
        )
        self.assertEqual([item["id"] for item in message_page["items"]], [message_result["message"]["id"], member_message["message"]["id"]])

        deleted_message = await main.delete_collaboration_message(
            room_id,
            member_message["message"]["id"],
            current_user=owner,
        )
        self.assertTrue(deleted_message["ok"])

        removed = await main.remove_collaboration_room_member(
            room_id,
            "student2@example.com",
            current_user=owner,
        )
        self.assertNotIn("student2@example.com", {member["email"] for member in removed["members"]})
        with self.assertRaises(main.HTTPException):
            await main.get_collaboration_room(room_id, current_user="student2@example.com")

    def test_invitation_email_contains_authenticated_room_link(self):
        with patch.object(main, "get_smtp_settings", return_value={
            "from_email": "hello@mabaso.ai", "host": "smtp.gmail.com", "port": 587,
            "use_tls": True, "use_ssl": False, "username": "hello@mabaso.ai",
        }), patch.object(
            main,
            "send_smtp_message",
        ) as send_message:
            main.send_collaboration_invite_email(
                "student@gmail.com",
                "owner@example.com",
                "Signals Study Group",
                "room-123",
                "secure-token",
            )
        message = send_message.call_args.args[0]
        self.assertEqual(message["To"], "student@gmail.com")
        plain_body = message.get_body(preferencelist=("plain",)).get_content()
        self.assertIn("/app/collaboration?room=room-123", plain_body)
        self.assertIn("invitation=secure-token", plain_body)
        self.assertIn("sign in", plain_body.lower())

    async def test_invitation_delivery_invokes_smtp_and_records_delivery(self):
        now_iso = main.utc_now().isoformat()
        with main.get_db_connection() as connection:
            connection.execute(
                """
                INSERT INTO collaboration_room_invites (
                    id, token_hash, room_id, inviter_email, invited_email, status,
                    email_status, email_error, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                ("invite-1", "hash", "room-1", "owner@example.com", "student@example.com", "pending", "pending", "", now_iso, now_iso),
            )
        with patch.object(main, "send_collaboration_invite_email") as send_email, patch.object(main, "record_audit_log"):
            await main.deliver_collaboration_invite_emails(
                [{"id": "invite-1", "email": "student@example.com", "token": "secure-token"}],
                "owner@example.com",
                "Signals",
                "room-1",
            )
        send_email.assert_called_once_with(
            "student@example.com", "owner@example.com", "Signals", "room-1", "secure-token"
        )
        with main.get_db_connection() as connection:
            row = connection.execute("SELECT email_status, email_error FROM collaboration_room_invites WHERE id = ?", ("invite-1",)).fetchone()
        self.assertEqual(row["email_status"], "sent")
        self.assertEqual(row["email_error"], "")

    async def test_invitation_email_failure_keeps_invitation_and_records_safe_error(self):
        now_iso = main.utc_now().isoformat()
        with main.get_db_connection() as connection:
            connection.execute(
                """
                INSERT INTO collaboration_room_invites (
                    id, token_hash, room_id, inviter_email, invited_email, status,
                    email_status, email_error, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                ("invite-failed", "hash-failed", "room-2", "owner@example.com", "student@example.com", "pending", "pending", "", now_iso, now_iso),
            )
        with patch.object(main, "send_collaboration_invite_email", side_effect=main.HTTPException(status_code=502, detail="SMTP login failed")), patch.object(main, "record_audit_log"):
            await main.deliver_collaboration_invite_emails(
                [{"id": "invite-failed", "email": "student@example.com", "token": "secure-token"}],
                "owner@example.com",
                "Signals",
                "room-2",
            )
        with main.get_db_connection() as connection:
            row = connection.execute("SELECT status, email_status, email_error FROM collaboration_room_invites WHERE id = ?", ("invite-failed",)).fetchone()
        self.assertEqual(row["status"], "pending")
        self.assertEqual(row["email_status"], "failed")
        self.assertIn("SMTP login failed", row["email_error"])


if __name__ == "__main__":
    unittest.main()
