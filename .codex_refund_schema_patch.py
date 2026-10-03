from pathlib import Path

path = Path("backend/main.py")
text = path.read_text(encoding="utf-8")

replacements = [
    (
        'from supabase_chat_history import (\n    SupabaseChatHistoryError,\n    SupabaseChatHistoryStore,\n)',
        'from supabase_chat_history import (\n    SupabaseChatHistoryError,\n    SupabaseChatHistoryStore,\n)\nfrom refund_policy import (\n    ACTIVE_REFUND_STATUSES,\n    REFUND_REASON_CODES,\n    PayFastApiClient,\n    PayFastApiError,\n    RefundPolicyConfig,\n    evaluate_refund_eligibility,\n    money as refund_money,\n    normalize_country as normalize_billing_country,\n)',
    ),
    (
        'class BillingCheckoutRequest(BaseModel):\n    plan_id: str\n    trial: bool = False',
        '''class BillingCheckoutRequest(BaseModel):
    plan_id: str
    trial: bool = False
    billing_country: str = ""


class RefundRequestCreate(BaseModel):
    payment_id: str
    reason_code: str
    reason_text: str = ""


class RefundAdminDecision(BaseModel):
    admin_note: str = ""
    bank_details: dict[str, str] = {}


class SubscriptionCancelRequest(BaseModel):
    reason: str = ""''',
    ),
]

for old, new in replacements:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"replace count={count}: {old[:100]!r}")
    text = text.replace(old, new, 1)

schema_anchor = '''        connection.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_billing_payments_email_paid_at
            ON billing_payments (email, paid_at DESC)
            """
        )
'''
schema_insert = schema_anchor + '''        checkout_columns = {row["name"] for row in connection.execute("PRAGMA table_info(billing_checkout_sessions)").fetchall()}
        if "billing_country_at_purchase" not in checkout_columns:
            connection.execute("ALTER TABLE billing_checkout_sessions ADD COLUMN billing_country_at_purchase TEXT NOT NULL DEFAULT ''")
        payment_columns = {row["name"] for row in connection.execute("PRAGMA table_info(billing_payments)").fetchall()}
        payment_column_defaults = {
            "billing_country_at_purchase": "TEXT NOT NULL DEFAULT ''",
            "currency": "TEXT NOT NULL DEFAULT 'ZAR'",
            "refunded_amount_zar": "TEXT NOT NULL DEFAULT '0.00'",
            "chargeback_status": "TEXT NOT NULL DEFAULT ''",
            "provider_refund_status": "TEXT NOT NULL DEFAULT ''",
        }
        for column_name, column_definition in payment_column_defaults.items():
            if column_name not in payment_columns:
                connection.execute(f"ALTER TABLE billing_payments ADD COLUMN {column_name} {column_definition}")
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS refund_requests (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL DEFAULT '',
                email TEXT NOT NULL,
                payment_id TEXT NOT NULL,
                pf_payment_id TEXT NOT NULL DEFAULT '',
                subscription_id TEXT NOT NULL DEFAULT '',
                provider_token TEXT NOT NULL DEFAULT '',
                original_amount TEXT NOT NULL,
                requested_amount TEXT NOT NULL,
                approved_amount TEXT NOT NULL DEFAULT '0.00',
                currency TEXT NOT NULL DEFAULT 'ZAR',
                billing_country_at_purchase TEXT NOT NULL DEFAULT '',
                reason_code TEXT NOT NULL,
                reason_text TEXT NOT NULL DEFAULT '',
                status TEXT NOT NULL,
                eligibility_window_days INTEGER NOT NULL DEFAULT 0,
                policy_type TEXT NOT NULL DEFAULT 'company_goodwill_policy',
                eligibility_reason TEXT NOT NULL DEFAULT '',
                requested_at TEXT NOT NULL,
                approved_at TEXT NOT NULL DEFAULT '',
                rejected_at TEXT NOT NULL DEFAULT '',
                processed_at TEXT NOT NULL DEFAULT '',
                completed_at TEXT NOT NULL DEFAULT '',
                provider_refund_reference TEXT NOT NULL DEFAULT '',
                provider_status TEXT NOT NULL DEFAULT '',
                provider_error TEXT NOT NULL DEFAULT '',
                provider_response_json TEXT NOT NULL DEFAULT '{}',
                usage_snapshot_json TEXT NOT NULL DEFAULT '{}',
                estimated_ai_cost_since_charge TEXT NOT NULL DEFAULT '0.00',
                automatic_or_manual TEXT NOT NULL DEFAULT 'manual',
                admin_user_id TEXT NOT NULL DEFAULT '',
                admin_note TEXT NOT NULL DEFAULT '',
                idempotency_key TEXT NOT NULL UNIQUE,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
            """
        )
        connection.execute("CREATE INDEX IF NOT EXISTS idx_refund_requests_email_created ON refund_requests (email, created_at DESC)")
        connection.execute("CREATE INDEX IF NOT EXISTS idx_refund_requests_payment_status ON refund_requests (payment_id, status)")
        connection.execute("CREATE INDEX IF NOT EXISTS idx_refund_requests_status_created ON refund_requests (status, created_at DESC)")
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS refund_audit_events (
                id TEXT PRIMARY KEY,
                refund_request_id TEXT NOT NULL,
                payment_id TEXT NOT NULL DEFAULT '',
                actor_email TEXT NOT NULL DEFAULT '',
                actor_type TEXT NOT NULL DEFAULT 'system',
                action TEXT NOT NULL,
                safe_metadata_json TEXT NOT NULL DEFAULT '{}',
                created_at TEXT NOT NULL
            )
            """
        )
        connection.execute("CREATE INDEX IF NOT EXISTS idx_refund_audit_request_created ON refund_audit_events (refund_request_id, created_at)")
'''
if text.count(schema_anchor) != 1:
    raise SystemExit(f"schema anchor count={text.count(schema_anchor)}")
text = text.replace(schema_anchor, schema_insert, 1)
path.write_text(text, encoding="utf-8", newline="")
