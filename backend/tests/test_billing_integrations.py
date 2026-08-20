import unittest
from datetime import datetime, timezone
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
                "start_time": 1787184000,
                "results": [
                    {"amount": {"value": 0.06, "currency": "usd"}, "line_item": "Responses API", "project_id": "proj_mabaso"},
                    {"amount": {"value": 0.14, "currency": "usd"}, "line_item": "Responses API", "project_id": "proj_mabaso"},
                ]
            }]
        }])
        self.assertTrue(summary["available"])
        self.assertEqual(summary["currency"], "usd")
        self.assertAlmostEqual(summary["total_cost"], 0.20)
        self.assertAlmostEqual(summary["by_line_item"][0]["cost"], 0.20)
        self.assertEqual(summary["by_project"][0]["project_id"], "proj_mabaso")
        self.assertAlmostEqual(summary["daily"][0]["cost"], 0.20)

    def test_openai_usage_summary_reports_provider_token_and_request_totals(self):
        summary = main.summarize_openai_completion_usage([{
            "data": [{
                "start_time": 1787184000,
                "results": [{
                    "model": "gpt-4.1",
                    "input_tokens": 120,
                    "output_tokens": 45,
                    "input_cached_tokens": 30,
                    "num_model_requests": 3,
                }],
            }],
        }])
        self.assertEqual(summary["totals"], {
            "input_tokens": 120,
            "output_tokens": 45,
            "cached_tokens": 30,
            "requests": 3,
        })
        self.assertEqual(summary["by_model"][0]["model"], "gpt-4.1")

    def test_openai_cost_request_is_scoped_to_configured_project(self):
        class FakeResponse:
            def raise_for_status(self):
                return None

            def json(self):
                return {"data": [], "has_more": False}

        start = datetime(2026, 8, 1, tzinfo=timezone.utc)
        end = datetime(2026, 8, 2, tzinfo=timezone.utc)
        with patch.multiple(main, OPENAI_ADMIN_KEY="admin-key", OPENAI_PROJECT_ID="proj_mabaso"), \
                patch.object(main.requests, "get", return_value=FakeResponse()) as request_get:
            main._openai_cost_cache.update({"cache_key": "", "expires_at": 0.0, "value": None})
            result = main.fetch_openai_organization_costs(start, end)

        self.assertEqual(result["scope"], "project")
        params = request_get.call_args.kwargs["params"]
        self.assertIn(("project_ids", "proj_mabaso"), params)
        self.assertIn(("group_by", "project_id"), params)
        self.assertIn(("group_by", "line_item"), params)


if __name__ == "__main__":
    unittest.main()
