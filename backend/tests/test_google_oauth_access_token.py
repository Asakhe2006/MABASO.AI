import sys
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import main


class GoogleOAuthAccessTokenTests(unittest.TestCase):
    def test_requires_matching_audience_and_verified_email(self):
        response = SimpleNamespace(
            status_code=200,
            json=lambda: {
                "aud": main.GOOGLE_CLIENT_ID,
                "email": "student@example.com",
                "email_verified": "true",
            },
        )
        with (
            patch.object(main, "verify_google_auth_is_configured"),
            patch.object(main.requests, "get", return_value=response) as google_request,
            patch.object(main, "ensure_user_account_is_active"),
            patch.object(main, "mark_user_verified"),
            patch.object(main, "create_session", return_value="session-token"),
        ):
            result = main.create_session_from_google_access_token("access-token")

        self.assertEqual(result, ("session-token", "student@example.com"))
        google_request.assert_called_once_with(
            "https://oauth2.googleapis.com/tokeninfo",
            params={"access_token": "access-token"},
            timeout=12,
        )

    def test_rejects_another_oauth_client(self):
        response = SimpleNamespace(
            status_code=200,
            json=lambda: {
                "aud": "another-google-client",
                "email": "student@example.com",
                "email_verified": "true",
            },
        )
        with (
            patch.object(main, "verify_google_auth_is_configured"),
            patch.object(main.requests, "get", return_value=response),
        ):
            with self.assertRaises(main.HTTPException) as raised:
                main.create_session_from_google_access_token("access-token")

        self.assertEqual(raised.exception.status_code, 401)


if __name__ == "__main__":
    unittest.main()
