import unittest
import sys
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import main


class SessionAuthenticationTests(unittest.TestCase):
    def setUp(self):
        main._session_context_cache.clear()
        main._session_last_seen_at.clear()
        main._session_subscription_checked_at.clear()

    def test_valid_session_context_is_cached(self):
        context = {"email": "student@example.com", "mode": "user", "available_modes": ["user"]}
        with patch.object(main, "get_session_context", return_value=context) as load_context:
            first_context, first_hit = main.get_cached_session_context("session-token")
            second_context, second_hit = main.get_cached_session_context("session-token")

        self.assertEqual(first_context, context)
        self.assertEqual(second_context, context)
        self.assertFalse(first_hit)
        self.assertTrue(second_hit)
        load_context.assert_called_once_with("session-token")

    def test_request_state_prevents_duplicate_validation(self):
        request = SimpleNamespace(state=SimpleNamespace(), cookies={}, headers={})
        context = {"email": "student@example.com", "mode": "user", "available_modes": ["user"]}
        with patch.object(main, "get_cached_session_context", return_value=(context, False)) as load_context:
            first = main.get_verified_request_session(
                request,
                "Bearer session-token",
                require_csrf=False,
            )
            second = main.get_verified_request_session(
                request,
                "Bearer session-token",
                require_csrf=False,
            )

        self.assertEqual(first, ("session-token", context))
        self.assertEqual(second, first)
        self.assertEqual(request.state.user, "student@example.com")
        load_context.assert_called_once_with("session-token")

    def test_session_maintenance_is_throttled(self):
        context = {"email": "student@example.com", "mode": "user", "available_modes": ["user"]}
        request = SimpleNamespace()

        class ImmediateThread:
            def __init__(self, *, target, **_kwargs):
                self.target = target

            def start(self):
                self.target()

        with (
            patch.object(main.threading, "Thread", ImmediateThread),
            patch.object(main, "touch_account_session") as touch_session,
            patch.object(main, "expire_subscription_if_needed") as check_subscription,
        ):
            main.queue_session_maintenance("session-token", context, request)
            main.queue_session_maintenance("session-token", context, request)

        touch_session.assert_called_once_with("session-token", request)
        check_subscription.assert_called_once_with("student@example.com")

    def test_cache_invalidation_by_user_removes_all_user_sessions(self):
        main._session_context_cache.update({
            "one": (float("inf"), {"email": "student@example.com"}),
            "two": (float("inf"), {"email": "student@example.com"}),
            "other": (float("inf"), {"email": "other@example.com"}),
        })

        main.invalidate_session_context_cache(email="student@example.com")

        self.assertNotIn("one", main._session_context_cache)
        self.assertNotIn("two", main._session_context_cache)
        self.assertIn("other", main._session_context_cache)


if __name__ == "__main__":
    unittest.main()
