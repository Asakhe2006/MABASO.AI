import asyncio
import sys
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from fastapi import HTTPException
from fastapi.responses import Response

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import main


class CsrfValidationTests(unittest.TestCase):
    def test_cookie_authenticated_write_accepts_matching_csrf_header(self):
        session_token = "signed-session-token"
        csrf_token = main.build_csrf_cookie_value(session_token)
        request = SimpleNamespace(
            method="POST",
            headers={"x-csrf-token": csrf_token},
            cookies={
                main.SESSION_COOKIE_NAME: session_token,
                main.CSRF_COOKIE_NAME: csrf_token,
            },
        )

        self.assertEqual(main.get_request_session_token(request), session_token)

    def test_cookie_authenticated_write_rejects_missing_csrf_header(self):
        session_token = "signed-session-token"
        csrf_token = main.build_csrf_cookie_value(session_token)
        request = SimpleNamespace(
            method="POST",
            headers={},
            cookies={
                main.SESSION_COOKIE_NAME: session_token,
                main.CSRF_COOKIE_NAME: csrf_token,
            },
        )

        with self.assertRaises(HTTPException) as context:
            main.get_request_session_token(request)

        self.assertEqual(context.exception.status_code, 403)

    def test_csrf_refresh_returns_session_bound_token_without_caching(self):
        session_token = "signed-session-token"
        request = SimpleNamespace(
            method="GET",
            headers={},
            cookies={main.SESSION_COOKIE_NAME: session_token},
        )
        response = Response()
        session_context = {
            "email": "student@example.com",
            "mode": "user",
            "available_modes": ["user"],
        }

        with patch.object(main, "get_session_context", return_value=session_context):
            payload = asyncio.run(main.refresh_auth_csrf(request, response))

        self.assertTrue(main.is_valid_csrf_cookie_value(session_token, payload["csrf_token"]))
        self.assertEqual(response.headers["cache-control"], "no-store, private")
        set_cookie_headers = [
            value.decode("latin-1")
            for name, value in response.raw_headers
            if name.lower() == b"set-cookie"
        ]
        self.assertTrue(any(main.CSRF_COOKIE_NAME in value for value in set_cookie_headers))


if __name__ == "__main__":
    unittest.main()
