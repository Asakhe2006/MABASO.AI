import asyncio
import os
import sqlite3
import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

from fastapi import Request
from fastapi import HTTPException

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
    def make_recovery_database(self, *, email="student@example.test", checkout_id="mabaso-0123456789abcdef01234567", token=""):
        connection = sqlite3.connect(":memory:")
        connection.row_factory = sqlite3.Row
        connection.executescript("""
            CREATE TABLE billing_checkout_sessions (
                id TEXT PRIMARY KEY, email TEXT, plan_id TEXT, amount_zar TEXT,
                provider TEXT, provider_payment_id TEXT, provider_token TEXT,
                status TEXT, checkout_fields_json TEXT, raw_event_json TEXT,
                billing_country_at_purchase TEXT, created_at TEXT, updated_at TEXT
            );
            CREATE TABLE billing_events (
                id TEXT PRIMARY KEY, email TEXT, checkout_session_id TEXT,
                provider TEXT, event_type TEXT, payload_json TEXT, created_at TEXT
            );
            CREATE TABLE billing_subscriptions (
                email TEXT PRIMARY KEY, provider TEXT, provider_token TEXT,
                status TEXT, current_period_end TEXT
            );
            CREATE TABLE users (email TEXT PRIMARY KEY, trial_used_at TEXT);
            CREATE TABLE trial_claims (
                id TEXT PRIMARY KEY, email TEXT, checkout_session_id TEXT,
                provider_token_hash TEXT, created_at TEXT
            );
        """)
        now = datetime.now(timezone.utc).isoformat()
        connection.execute(
            "INSERT INTO billing_checkout_sessions VALUES (?, ?, 'pro_student', '0.00', 'payfast', '', ?, 'pending', ?, '{}', 'ZA', ?, ?)",
            (checkout_id, email, token, '{"custom_str4":"trial"}', now, now),
        )
        connection.execute("INSERT INTO users VALUES (?, '')", (email,))
        connection.commit()
        return connection

    def test_payfast_webhook_readiness_exposes_no_configuration_or_secrets(self):
        payload = main.payfast_webhook_readiness()
        self.assertEqual(payload["status"], "ready")
        self.assertIn("POST", payload["message"])
        serialized = str(payload).lower()
        self.assertNotIn("merchant", serialized)
        self.assertNotIn("passphrase", serialized)

    def test_render_hostname_wins_over_stale_api_public_url_for_payfast_callbacks(self):
        with patch.object(main, "API_PUBLIC_URL", "https://retired-service.onrender.com"), \
                patch.dict(os.environ, {"RENDER_EXTERNAL_HOSTNAME": "mabaso-ai-api.onrender.com"}):
            self.assertEqual(
                main.get_request_public_base_url(make_request()),
                "https://mabaso-ai-api.onrender.com",
            )

    def test_payfast_subscription_fetch_uses_documented_fetch_operation(self):
        client = main.PayFastApiClient(merchant_id="merchant", passphrase="passphrase")
        with patch.object(client, "_request", return_value={"status": {"code": 200}}) as request:
            client.fetch_subscription("token-123")
        request.assert_called_once_with("GET", "/subscriptions/token-123/fetch")

    def test_payfast_subscription_parser_reads_nested_response(self):
        state = main.parse_payfast_subscription_state({
            "data": {
                "response": {
                    "status": 1,
                    "status_text": "ACTIVE",
                    "amount": 5000,
                    "cycles_complete": 0,
                    "run_date": "2026-10-12",
                    "token": "provider-token-1234567890",
                    "email_address": "Student@Example.Test",
                }
            }
        })
        self.assertTrue(state["active"])
        self.assertEqual(state["amount_cents"], 5000)
        self.assertEqual(state["run_date"], "2026-10-12")
        self.assertEqual(state["email"], "student@example.test")

    def test_subscription_webhook_is_verified_with_payfast_before_activation(self):
        event = {"type": "subscription.free-trial", "token": "provider-token-1234567890"}
        verified = {"data": {"response": {"status": 1, "amount": 5000}}}
        session = {"id": "mabaso-checkout", "email": "student@example.test"}
        client = type("Client", (), {"fetch_subscription": lambda _self, token: verified})()
        with patch.object(main, "find_checkout_for_payfast_subscription_event", return_value=session), \
                patch.object(main, "get_payfast_api_client", return_value=client), \
                patch.object(main, "activate_payfast_trial_from_verified_subscription", return_value={"status": "trialing"}) as activate:
            result = asyncio.run(main.process_payfast_subscription_event(event))
        self.assertEqual(result["status"], "trialing")
        activate.assert_called_once_with(
            session=session,
            provider_token="provider-token-1234567890",
            provider_payload=verified,
            event_payload=event,
        )

    def test_admin_recovery_verifies_payfast_before_recovering_missed_trial(self):
        future_run = (datetime.now(timezone.utc) + timedelta(days=7)).date().isoformat()
        session = {
            "id": "mabaso-1234567890abcdef12345678",
            "email": "student@example.test",
            "plan_id": "pro_student",
            "amount_zar": "50.00",
            "provider": "payfast",
            "provider_payment_id": "",
            "provider_token": "",
            "status": "pending",
            "checkout_fields_json": '{"custom_str4": "trial"}',
            "raw_event_json": "{}",
            "billing_country_at_purchase": "ZA",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }

        class FakeConnection:
            def __enter__(self):
                return self

            def __exit__(self, *_args):
                return False

            def execute(self, sql, _parameters=()):
                value = {"trial_used_at": ""} if "SELECT trial_used_at" in sql else session
                return type("Result", (), {"fetchone": lambda _self: value})()

        verified = {"data": {"response": {
            "status": 1,
            "status_text": "ACTIVE",
            "amount": 5000,
            "cycles_complete": 0,
            "frequency": 3,
            "run_date": future_run,
            "token": "provider-token-1234567890",
            "email_address": "student@example.test",
        }}}
        client = type("Client", (), {"fetch_subscription": lambda _self, _token: verified})()
        with patch.object(main, "get_db_connection", return_value=FakeConnection()), \
                patch.object(main, "get_payfast_api_client", return_value=client), \
                patch.object(main, "activate_payfast_trial_from_verified_subscription", return_value={
                    "status": "trialing",
                    "checkout_id": session["id"],
                    "trial_ends_at": future_run,
                }) as activate:
            result = main.recover_pending_payfast_trial(
                email="student@example.test",
                provider_token="provider-token-1234567890",
                checkout_id=session["id"],
            )

        self.assertEqual(result["status"], "trialing")
        self.assertNotIn("provider_token", result)
        event_payload = activate.call_args.kwargs["event_payload"]
        self.assertEqual(event_payload["amount"], "5000")
        self.assertEqual(event_payload["initial_amount"], "0")

    def test_admin_recovery_rejects_subscription_that_already_charged(self):
        future_run = (datetime.now(timezone.utc) + timedelta(days=7)).date().isoformat()

        class FakeConnection:
            def __enter__(self):
                return self

            def __exit__(self, *_args):
                return False

            def execute(self, sql, _parameters=()):
                if "SELECT trial_used_at" in sql:
                    value = {"trial_used_at": ""}
                else:
                    value = {"id": "mabaso-checkout-12345678", "email": "student@example.test", "plan_id": "pro_student"}
                return type("Result", (), {"fetchone": lambda _self: value})()

        verified = {"data": {"response": {
            "status": 1,
            "amount": 5000,
            "cycles_complete": 1,
            "run_date": future_run,
        }}}
        client = type("Client", (), {"fetch_subscription": lambda _self, _token: verified})()
        with patch.object(main, "get_db_connection", return_value=FakeConnection()), \
                patch.object(main, "get_payfast_api_client", return_value=client):
            with self.assertRaises(HTTPException) as raised:
                main.recover_pending_payfast_trial(
                    email="student@example.test",
                    provider_token="provider-token-1234567890",
                )
        self.assertEqual(raised.exception.status_code, 409)
        self.assertIn("already charged", raised.exception.detail)

    def test_admin_recovery_endpoint_never_audits_or_returns_provider_token(self):
        token = "provider-token-1234567890"
        recovered = {
            "status": "trialing",
            "checkout_id": "mabaso-checkout-12345678",
            "email": "student@example.test",
            "trial_ends_at": "2030-01-08T00:00:00+00:00",
            "message": "Recovered.",
        }
        with patch.object(main, "enforce_rate_limit"), \
                patch.object(main, "recover_pending_payfast_trial", return_value=recovered), \
                patch.object(main, "record_audit_log") as audit:
            result = main.recover_admin_payfast_trial(
                "student@example.test",
                main.PayFastSubscriptionRecoveryRequest(
                    provider_token=token,
                    checkout_id="mabaso-checkout-12345678",
                ),
                make_request(),
                current_admin="admin@example.test",
            )
        self.assertEqual(result, recovered)
        self.assertNotIn(token, str(result))
        self.assertNotIn(token, str(audit.call_args))

    def test_checkout_reference_resolves_saved_verified_token(self):
        token = "dc0521d3-55fe-269b-fa00-b647310d760f"
        checkout_id = "mabaso-0123456789abcdef01234567"
        connection = self.make_recovery_database(checkout_id=checkout_id, token=token)
        with patch.object(main, "get_db_connection", return_value=connection):
            context = main.resolve_payfast_recovery_context(
                email="student@example.test", identifier=checkout_id,
            )
        self.assertEqual(context["identifier_type"], "checkout_reference")
        self.assertEqual(context["token"], token)
        self.assertFalse(context["already_recovered"])
        connection.close()

    def test_checkout_reference_without_verified_token_never_recovers(self):
        checkout_id = "mabaso-0123456789abcdef01234567"
        connection = self.make_recovery_database(checkout_id=checkout_id)
        with patch.object(main, "get_db_connection", return_value=connection):
            with self.assertRaises(HTTPException) as raised:
                main.resolve_payfast_recovery_context(
                    email="student@example.test", identifier=checkout_id,
                )
        self.assertEqual(raised.exception.status_code, 409)
        self.assertIn("no PayFast subscription token", raised.exception.detail)
        connection.close()

    def test_checkout_reference_rejects_selected_customer_mismatch(self):
        checkout_id = "mabaso-0123456789abcdef01234567"
        connection = self.make_recovery_database(email="owner@example.test", checkout_id=checkout_id)
        with patch.object(main, "get_db_connection", return_value=connection):
            with self.assertRaises(HTTPException) as raised:
                main.resolve_payfast_recovery_context(
                    email="different@example.test", identifier=checkout_id,
                )
        self.assertEqual(raised.exception.status_code, 409)
        self.assertIn("selected Mabaso AI user", raised.exception.detail)
        connection.close()

    def test_already_recovered_subscription_is_idempotent(self):
        token = "dc0521d3-55fe-269b-fa00-b647310d760f"
        checkout_id = "mabaso-0123456789abcdef01234567"
        connection = self.make_recovery_database(checkout_id=checkout_id, token=token)
        connection.execute(
            "INSERT INTO billing_subscriptions VALUES (?, 'payfast', ?, 'trialing', '2030-01-08T00:00:00+00:00')",
            ("student@example.test", token),
        )
        connection.commit()
        with patch.object(main, "get_db_connection", return_value=connection), \
                patch.object(main, "get_payfast_api_client") as client:
            result = main.recover_pending_payfast_trial(
                email="student@example.test", identifier=checkout_id,
            )
        self.assertEqual(result["result_code"], "ALREADY_RECOVERED")
        client.assert_not_called()
        connection.close()

    def test_invalid_recovery_identifier_is_rejected(self):
        with self.assertRaises(HTTPException) as raised:
            main.classify_payfast_recovery_identifier("mabaso-not-a-checkout")
        self.assertEqual(raised.exception.status_code, 400)

    def test_zero_value_trial_is_never_refundable(self):
        summary = main.get_payment_refund_summary({"amount_zar": "0.00"})
        self.assertFalse(summary["eligible"])
        self.assertEqual(summary["reason"], "no_charge_to_refund")

    def test_trial_eligibility_uses_parameterized_pattern_and_three_sessions(self):
        statements = []

        class FakeConnection:
            def __enter__(self):
                return self

            def __exit__(self, *_args):
                return False

            def execute(self, sql, parameters=()):
                statements.append((sql, parameters))
                if "COUNT(*) AS session_count" in sql:
                    return type("Result", (), {"fetchone": lambda _self: {"session_count": 3}})()
                if "checkout_fields_json LIKE ?" in sql:
                    self_test.assertEqual(parameters[1], '%"custom_str4": "trial"%')
                return type("Result", (), {"fetchone": lambda _self: None})()

        self_test = self
        with patch.object(main, "get_user_subscription", return_value={"active": False, "trial_active": False}), \
                patch.object(main, "get_db_connection", return_value=FakeConnection()), \
                patch.object(main, "FREE_TRIAL_MIN_ACCOUNT_SESSIONS", 3):
            eligibility = main.get_payfast_trial_eligibility("student@example.test")

        self.assertTrue(eligibility["eligible"])
        self.assertEqual(eligibility["session_count"], 3)
        self.assertEqual(len(statements), 4)

    def test_trial_used_at_permanently_blocks_another_trial(self):
        class FakeConnection:
            def __enter__(self):
                return self

            def __exit__(self, *_args):
                return False

            def execute(self, sql, _parameters=()):
                if "SELECT trial_status, trial_used_at" in sql:
                    value = {"trial_status": "expired", "trial_used_at": "2026-10-01T00:00:00+00:00"}
                elif "COUNT(*) AS session_count" in sql:
                    value = {"session_count": 8}
                else:
                    value = None
                return type("Result", (), {"fetchone": lambda _self: value})()

        with patch.object(main, "get_user_subscription", return_value={"active": False, "trial_active": False}), \
                patch.object(main, "get_db_connection", return_value=FakeConnection()):
            eligibility = main.get_payfast_trial_eligibility("student@example.test")

        self.assertFalse(eligibility["eligible"])
        self.assertEqual(eligibility["reason"], "trial_already_started_or_used")

    def test_trial_claim_hashes_provider_identifiers(self):
        connection = sqlite3.connect(":memory:")
        connection.row_factory = sqlite3.Row
        connection.execute(
            """
            CREATE TABLE trial_claims (
                id TEXT PRIMARY KEY, email TEXT NOT NULL, identity_hash TEXT NOT NULL UNIQUE,
                payment_fingerprint_hash TEXT NOT NULL DEFAULT '', provider_token_hash TEXT NOT NULL DEFAULT '',
                provider TEXT NOT NULL, checkout_session_id TEXT NOT NULL, provider_payment_id TEXT NOT NULL,
                status TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
            )
            """
        )
        main.record_trial_claim(
            connection,
            email="student@example.test",
            checkout_session_id="checkout-1",
            provider_payment_id="pf-1",
            provider_token="raw-provider-token",
            provider_payload={"payment_method_fingerprint": "raw-card-fingerprint"},
            now_iso="2026-10-06T12:00:00+00:00",
        )
        row = connection.execute("SELECT * FROM trial_claims").fetchone()
        self.assertNotEqual(row["provider_token_hash"], "raw-provider-token")
        self.assertNotEqual(row["payment_fingerprint_hash"], "raw-card-fingerprint")
        self.assertEqual(len(row["provider_token_hash"]), 64)
        self.assertEqual(len(row["payment_fingerprint_hash"]), 64)
        connection.close()

    def test_trial_is_hidden_server_side_before_three_sessions(self):
        class FakeConnection:
            def __enter__(self):
                return self

            def __exit__(self, *_args):
                return False

            def execute(self, sql, _parameters=()):
                value = {"session_count": 2} if "COUNT(*) AS session_count" in sql else None
                return type("Result", (), {"fetchone": lambda _self: value})()

        with patch.object(main, "get_user_subscription", return_value={"active": False, "trial_active": False}), \
                patch.object(main, "get_db_connection", return_value=FakeConnection()), \
                patch.object(main, "FREE_TRIAL_MIN_ACCOUNT_SESSIONS", 3):
            with self.assertRaises(HTTPException) as raised:
                main.ensure_payfast_trial_eligible("student@example.test", "pro_student")

        self.assertEqual(raised.exception.status_code, 409)
        self.assertIn("3 account sessions", raised.exception.detail)

    def test_diagnostics_plan_labels_accept_free_and_legacy_values(self):
        self.assertEqual(main.get_billing_plan_display_name("free"), "Free")
        self.assertEqual(main.get_billing_plan_display_name("legacy_research"), "Legacy Research")

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

    def test_zero_value_trial_transaction_is_valid(self):
        self.assertEqual(main.format_zar_transaction_amount("0.00"), "0.00")

    def test_legacy_no_card_trial_endpoint_is_disabled(self):
        with self.assertRaises(HTTPException) as raised:
            main.start_free_trial(make_request(), current_user="student@example.test")
        self.assertEqual(raised.exception.status_code, 410)
        self.assertIn("PayFast", raised.exception.detail)

    def test_diagnostics_overview_does_not_require_missing_environment_helper(self):
        result = main.build_admin_diagnostics_overview()
        self.assertIn(result["system_health"]["environment"], {"development", "production"})
        self.assertIn("MATPLOTLIB", result["environment_checks"])

    def test_payfast_checkout_uses_the_registered_webhook_route(self):
        with patch.object(main, "APP_PUBLIC_URL", "https://mabaso-ai-web.onrender.com"):
            fields = main.build_payfast_checkout_fields(
                request=make_request(),
                email="student@example.test",
                checkout_id="checkout-123",
                plan=main.get_billing_plan("pro_student"),
                trial=True,
            )
        self.assertEqual(fields["notify_url"], "https://api.example.test/api/billing/payfast/webhook")
        self.assertEqual(fields["return_url"], "https://mabaso-ai-web.onrender.com/payment-success?session_id=checkout-123")
        self.assertEqual(fields["cancel_url"], "https://mabaso-ai-web.onrender.com/pricing?billing=cancelled&session_id=checkout-123")

    def test_payfast_refund_payload_sanitizer_never_returns_secrets_or_full_identifiers(self):
        sanitized = main.sanitize_payfast_refund_payload({
            "data": {
                "response": {
                    "status": "REFUNDABLE",
                    "amount_available_for_refund": 5000,
                    "refund_id": "very-long-provider-refund-reference-123456789",
                    "merchant_key": "must-not-leak",
                    "passphrase": "must-not-leak",
                    "refund_full": {"method": "API", "secret": "must-not-leak"},
                }
            }
        })
        self.assertEqual(sanitized["status"], "REFUNDABLE")
        self.assertEqual(sanitized["amount_available_for_refund"], "5000")
        self.assertTrue(sanitized["refund_id"].startswith("..."))
        self.assertNotIn("merchant_key", sanitized)
        self.assertNotIn("passphrase", sanitized)
        self.assertNotIn("secret", sanitized["refund_full"])

    def test_payfast_refund_amount_accepts_decimal_provider_values(self):
        self.assertEqual(main.payfast_refund_amount_cents("5000.00"), 5000)
        with self.assertRaises(main.PayFastApiError):
            main.payfast_refund_amount_cents("not-an-amount")

    def test_admin_refund_status_counts_group_pending_and_provider_processing(self):
        rows = [
            {"status": "eligible", "total": 2},
            {"status": "manual_review", "total": 3},
            {"status": "under_review", "total": 4},
            {"status": "processing", "total": 1},
            {"status": "provider_accepted", "total": 2},
            {"status": "failed", "total": 1},
        ]

        class FakeConnection:
            def execute(self, _sql):
                return type("Result", (), {"fetchall": lambda _self: rows})()

        counts = main.get_admin_refund_status_counts(FakeConnection())
        self.assertEqual(counts["pending"], 5)
        self.assertEqual(counts["under_review"], 4)
        self.assertEqual(counts["processing"], 3)
        self.assertEqual(counts["failed"], 1)
        self.assertEqual(counts["all"], 13)

    def test_refund_admin_notification_email_uses_explicit_address_then_admin_fallback(self):
        with patch.object(main, "REFUND_ADMIN_NOTIFICATION_EMAIL", "billing@example.test"):
            self.assertEqual(main.get_refund_admin_notification_email(), "billing@example.test")
        with patch.object(main, "REFUND_ADMIN_NOTIFICATION_EMAIL", ""), \
                patch.object(main, "get_admin_email_set", return_value={"admin@example.test"}):
            self.assertEqual(main.get_refund_admin_notification_email(), "admin@example.test")

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
            "total_tokens": 165,
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
