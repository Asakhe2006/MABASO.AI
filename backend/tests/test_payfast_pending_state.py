import sqlite3
import tempfile
import unittest
from contextlib import contextmanager
from pathlib import Path
from unittest.mock import patch

from backend import main


FREE_ENTITLEMENT = {
    "entitlement": "free",
    "plan_id": "free",
    "trial_active": False,
    "subscription_active": False,
    "reason": "no_active_subscription_or_trial",
}


class PayFastPendingStateTests(unittest.TestCase):
    def test_local_checkout_creation_is_not_provider_confirmation(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            database_path = str(Path(temp_dir) / "billing.db")
            connection = sqlite3.connect(database_path)
            connection.execute(
                """
                CREATE TABLE billing_payments (
                    email TEXT, plan_id TEXT, payment_status TEXT, amount_zar TEXT,
                    provider TEXT, created_at TEXT, updated_at TEXT
                )
                """
            )
            connection.commit()
            connection.close()

            @contextmanager
            def open_database():
                owned = sqlite3.connect(database_path)
                owned.row_factory = sqlite3.Row
                try:
                    yield owned
                finally:
                    owned.close()

            local_checkout = {
                "id": "mabaso-local-checkout",
                "plan_id": "pro_student_monthly",
                "status": "pending",
                "provider_payment_id": "",
                "provider_token": "",
                "raw_event_json": "",
                "created_at": "2026-10-14T12:00:00Z",
                "updated_at": "2026-10-14T12:00:00Z",
            }
            with (
                patch.object(main, "reconcile_payfast_trial_payment_history"),
                patch.object(main, "get_user_subscription", return_value={"status": "free", "active": False}),
                patch.object(main, "resolve_entitlement", return_value=FREE_ENTITLEMENT),
                patch.object(main, "get_latest_pending_payfast_checkout", return_value=local_checkout),
                patch.object(main, "get_db_connection", side_effect=open_database),
            ):
                subscription, _ = main.get_effective_subscription_snapshot("student@example.test")

        self.assertEqual(subscription["status"], "free")
        self.assertFalse(subscription.get("confirmation_pending", False))

    def test_verified_provider_pending_event_is_exposed_as_pending(self):
        provider_checkout = {
            "id": "mabaso-provider-checkout",
            "plan_id": "pro_student_monthly",
            "status": "confirmation_pending",
            "provider_payment_id": "pf-payment-1",
            "provider_token": "token-from-payfast",
            "raw_event_json": "{\"payment_status\":\"PENDING\"}",
            "created_at": "2026-10-14T12:00:00Z",
            "updated_at": "2026-10-14T12:01:00Z",
        }
        with (
            patch.object(main, "reconcile_payfast_trial_payment_history"),
            patch.object(main, "get_user_subscription", return_value={"status": "free", "active": False}),
            patch.object(main, "resolve_entitlement", return_value=FREE_ENTITLEMENT),
            patch.object(main, "get_latest_pending_payfast_checkout", return_value=provider_checkout),
        ):
            subscription, _ = main.get_effective_subscription_snapshot("student@example.test")

        self.assertEqual(subscription["status"], "confirmation_pending")
        self.assertTrue(subscription["confirmation_pending"])
        self.assertEqual(subscription["pending_checkout_id"], "mabaso-provider-checkout")


if __name__ == "__main__":
    unittest.main()
