import os
import sys
import unittest
from email.message import EmailMessage
from pathlib import Path
from unittest.mock import Mock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import main


class BrevoTransactionalEmailTests(unittest.TestCase):
    def setUp(self):
        self.environment = patch.dict(os.environ, {
            "EMAIL_PROVIDER": "brevo",
            "BREVO_API_KEY": "secret-test-key",
            "EMAIL_FROM_ADDRESS": "hello@mabaso.ai",
            "EMAIL_FROM_NAME": "Mabaso AI",
        }, clear=False)
        self.environment.start()
        self.addCleanup(self.environment.stop)
        self.message = EmailMessage()
        self.message["Subject"] = "Room invitation"
        self.message["From"] = "hello@mabaso.ai"
        self.message["To"] = "student@example.com"
        self.message.set_content("Join your room")

    def test_brevo_success_posts_safe_payload(self):
        response = Mock(status_code=201)
        with patch.object(main.requests, "post", return_value=response) as post:
            main.send_transactional_message(self.message)
        _, kwargs = post.call_args
        self.assertEqual(kwargs["headers"]["api-key"], "secret-test-key")
        self.assertEqual(kwargs["json"]["sender"]["email"], "hello@mabaso.ai")
        self.assertEqual(kwargs["json"]["to"][0]["email"], "student@example.com")
        self.assertEqual(kwargs["timeout"], 8)

    def test_brevo_provider_errors_are_clear_and_do_not_leak_key(self):
        for status, expected in ((401, "authentication"), (403, "sender"), (429, "rate limiting"), (500, "temporarily unavailable")):
            with self.subTest(status=status), patch.object(main.requests, "post", return_value=Mock(status_code=status)):
                with self.assertRaises(main.HTTPException) as raised:
                    main.send_transactional_message(self.message)
            self.assertIn(expected, str(raised.exception.detail).lower())
            self.assertNotIn("secret-test-key", str(raised.exception.detail))

    def test_missing_brevo_key_and_invalid_provider_fail_before_send(self):
        with patch.dict(os.environ, {"BREVO_API_KEY": ""}, clear=False):
            with self.assertRaises(main.HTTPException) as raised:
                main.get_transactional_email_settings()
        self.assertIn("BREVO_API_KEY", str(raised.exception.detail))
        with patch.dict(os.environ, {"EMAIL_PROVIDER": "unknown"}, clear=False):
            with self.assertRaises(main.HTTPException) as raised:
                main.get_transactional_email_settings()
        self.assertIn("EMAIL_PROVIDER", str(raised.exception.detail))

    def test_timeout_and_invalid_recipient_are_safe(self):
        with patch.object(main.requests, "post", side_effect=main.requests.Timeout):
            with self.assertRaises(main.HTTPException) as raised:
                main.send_transactional_message(self.message)
        self.assertIn("timed out", str(raised.exception.detail).lower())
        invalid = EmailMessage()
        invalid["To"] = "not an email"
        invalid.set_content("Hello")
        with self.assertRaises(main.HTTPException):
            main.send_transactional_message(invalid)

