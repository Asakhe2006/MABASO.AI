import unittest
from unittest.mock import patch

from fastapi import Request

from backend import main


def make_request() -> Request:
    return Request({
        "type": "http",
        "method": "POST",
        "path": "/api/billing/checkout",
        "headers": [],
        "scheme": "https",
        "server": ("api.example.test", 443),
        "client": ("127.0.0.1", 1234),
        "query_string": b"",
    })


class BillingIntegrationTests(unittest.TestCase):
    def test_payfast_trial_fields_use_zero_initial_amount_and_signature_order(self):
        plan = {
            "id": "pro_student",
            "name": "Pro Student",
            "amount_zar": "50.00",
            "frequency": "3",
            "cycles": "0",
            "description": "Monthly Pro plan",
        }
        with patch.multiple(
            main,
            PAYFAST_MERCHANT_ID="10000100",
            PAYFAST_MERCHANT_KEY="46f0cd694581a",
            PAYFAST_PASSPHRASE="test-passphrase",
            PAYFAST_TRIAL_INITIAL_AMOUNT_ZAR="0.00",
            APP_PUBLIC_URL="https://app.example.test",
            API_PUBLIC_URL="https://api.example.test",
        ):
            fields = main.build_payfast_checkout_fields(
                request=make_request(),
                email="student@example.test",
                checkout_id="checkout-123",
                plan=plan,
                trial=True,
            )
            expected_signature = main.get_payfast_signature(fields)

        keys = list(fields)
        self.assertEqual(fields["amount"], "0.00")
        self.assertEqual(fields["payment_method"], "cc")
        self.assertEqual(fields["subscription_type"], "1")
        self.assertEqual(fields["recurring_amount"], "50.00")
        self.assertLess(keys.index("subscription_type"), keys.index("billing_date"))
        self.assertLess(keys.index("billing_date"), keys.index("recurring_amount"))
        self.assertEqual(fields["signature"], expected_signature)

    def test_free_trial_rejects_nonzero_initial_charge(self):
        with patch.object(main, "PAYFAST_TRIAL_INITIAL_AMOUNT_ZAR", "5.00"):
            with self.assertRaisesRegex(Exception, "must use PAYFAST_TRIAL_INITIAL_AMOUNT_ZAR=0.00"):
                main.format_payfast_trial_initial_amount()

    def test_openai_cost_summary_uses_returned_amount_without_token_pricing(self):
        summary = main.summarize_openai_cost_buckets([{
            "data": [{
                "results": [
                    {"amount": {"value": 0.06, "currency": "usd"}, "line_item": "Responses API"},
                    {"amount": {"value": 0.14, "currency": "usd"}, "line_item": "Responses API"},
                ]
            }]
        }])
        self.assertTrue(summary["available"])
        self.assertEqual(summary["currency"], "usd")
        self.assertAlmostEqual(summary["total_cost"], 0.20)
        self.assertAlmostEqual(summary["by_line_item"][0]["cost"], 0.20)


if __name__ == "__main__":
    unittest.main()
