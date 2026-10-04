import unittest
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from backend.refund_policy import RefundPolicyConfig, evaluate_refund_eligibility


class RefundPolicyTests(unittest.TestCase):
    def setUp(self):
        self.now = datetime(2026, 10, 4, 12, 0, tzinfo=timezone.utc)
        self.config = RefundPolicyConfig(
            za_window_days=14,
            default_window_days=7,
            country_overrides={"DE": 21},
            light_usage_max_events=3,
            light_usage_max_estimated_cost=Decimal("10.00"),
            auto_approve_enabled=False,
        )

    def evaluate(self, **overrides):
        values = {
            "payment_status": "complete",
            "paid_at": (self.now - timedelta(days=1)).isoformat(),
            "billing_country_at_purchase": "ZA",
            "original_amount": "199.00",
            "refunded_amount": "0.00",
            "chargeback_status": "",
            "reason_code": "accidental_purchase",
            "usage_snapshot": {"total_paid_feature_events": 0, "estimated_ai_cost_since_charge": "0.00"},
            "now": self.now,
            "config": self.config,
        }
        values.update(overrides)
        return evaluate_refund_eligibility(**values)

    def test_za_window_includes_exact_day_fourteen_boundary(self):
        result = self.evaluate(paid_at=(self.now - timedelta(days=14)).isoformat())
        self.assertTrue(result["eligible"])
        self.assertTrue(result["within_window"])
        self.assertEqual(result["eligibility_window_days"], 14)

    def test_non_za_default_window_expires_after_seven_days(self):
        result = self.evaluate(
            billing_country_at_purchase="US",
            paid_at=(self.now - timedelta(days=8)).isoformat(),
        )
        self.assertFalse(result["eligible"])
        self.assertEqual(result["reason"], "goodwill_window_expired")

    def test_configured_country_override_takes_precedence(self):
        result = self.evaluate(
            billing_country_at_purchase="DE",
            paid_at=(self.now - timedelta(days=20)).isoformat(),
        )
        self.assertTrue(result["eligible"])
        self.assertEqual(result["eligibility_window_days"], 21)
        self.assertEqual(result["policy_type"], "statutory_or_configured_override")

    def test_missing_country_requires_manual_review(self):
        result = self.evaluate(billing_country_at_purchase="")
        self.assertFalse(result["eligible"])
        self.assertEqual(result["status"], "manual_review")
        self.assertEqual(result["reason"], "billing_country_requires_review")

    def test_heavy_usage_is_reviewed_instead_of_rejected(self):
        result = self.evaluate(
            usage_snapshot={"total_paid_feature_events": 9, "estimated_ai_cost_since_charge": "25.00"}
        )
        self.assertTrue(result["eligible"])
        self.assertEqual(result["status"], "manual_review")

    def test_partial_refund_never_exceeds_remaining_balance(self):
        result = self.evaluate(original_amount="199.00", refunded_amount="49.00")
        self.assertEqual(result["remaining_refundable_amount"], "150.00")

    def test_fully_refunded_and_chargeback_payments_are_rejected(self):
        fully_refunded = self.evaluate(refunded_amount="199.00")
        disputed = self.evaluate(chargeback_status="active")
        self.assertEqual(fully_refunded["reason"], "no_refundable_balance")
        self.assertEqual(disputed["reason"], "active_chargeback_or_dispute")

    def test_failed_payment_is_not_refundable(self):
        result = self.evaluate(payment_status="failed")
        self.assertEqual(result["status"], "rejected")
        self.assertEqual(result["reason"], "payment_not_successful")

    def test_duplicate_charge_outside_window_goes_to_review(self):
        result = self.evaluate(
            reason_code="duplicate_charge",
            paid_at=(self.now - timedelta(days=45)).isoformat(),
        )
        self.assertEqual(result["status"], "manual_review")
        self.assertEqual(result["reason"], "exception_or_consumer_right_review")


if __name__ == "__main__":
    unittest.main()
