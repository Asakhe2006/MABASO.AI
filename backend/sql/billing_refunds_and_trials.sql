-- Additive production migration for Mabaso AI trials, immutable billing country,
-- subscription cancellation, and idempotent refund processing.

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS trial_status text NOT NULL DEFAULT 'eligible';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS trial_started_at text NOT NULL DEFAULT '';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS trial_ends_at text NOT NULL DEFAULT '';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS trial_used_at text NOT NULL DEFAULT '';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS billing_country text NOT NULL DEFAULT '';

ALTER TABLE public.billing_checkout_sessions ADD COLUMN IF NOT EXISTS billing_country_at_purchase text NOT NULL DEFAULT '';
ALTER TABLE public.billing_payments ADD COLUMN IF NOT EXISTS billing_country_at_purchase text NOT NULL DEFAULT '';
ALTER TABLE public.billing_payments ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'ZAR';
ALTER TABLE public.billing_payments ADD COLUMN IF NOT EXISTS refunded_amount_zar text NOT NULL DEFAULT '0.00';
ALTER TABLE public.billing_payments ADD COLUMN IF NOT EXISTS chargeback_status text NOT NULL DEFAULT '';
ALTER TABLE public.billing_payments ADD COLUMN IF NOT EXISTS provider_refund_status text NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS public.refund_requests (
    id text PRIMARY KEY,
    user_id text NOT NULL DEFAULT '',
    email text NOT NULL,
    payment_id text NOT NULL,
    pf_payment_id text NOT NULL DEFAULT '',
    subscription_id text NOT NULL DEFAULT '',
    provider_token text NOT NULL DEFAULT '',
    original_amount text NOT NULL,
    requested_amount text NOT NULL,
    approved_amount text NOT NULL DEFAULT '0.00',
    currency text NOT NULL DEFAULT 'ZAR',
    billing_country_at_purchase text NOT NULL DEFAULT '',
    reason_code text NOT NULL,
    reason_text text NOT NULL DEFAULT '',
    status text NOT NULL,
    eligibility_window_days integer NOT NULL DEFAULT 0,
    policy_type text NOT NULL DEFAULT 'company_goodwill_policy',
    eligibility_reason text NOT NULL DEFAULT '',
    requested_at text NOT NULL,
    approved_at text NOT NULL DEFAULT '',
    rejected_at text NOT NULL DEFAULT '',
    processed_at text NOT NULL DEFAULT '',
    completed_at text NOT NULL DEFAULT '',
    provider_refund_reference text NOT NULL DEFAULT '',
    provider_status text NOT NULL DEFAULT '',
    provider_error text NOT NULL DEFAULT '',
    provider_response_json text NOT NULL DEFAULT '{}',
    usage_snapshot_json text NOT NULL DEFAULT '{}',
    estimated_ai_cost_since_charge text NOT NULL DEFAULT '0.00',
    automatic_or_manual text NOT NULL DEFAULT 'manual',
    admin_user_id text NOT NULL DEFAULT '',
    admin_note text NOT NULL DEFAULT '',
    idempotency_key text NOT NULL UNIQUE,
    created_at text NOT NULL,
    updated_at text NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_refund_requests_email_created
    ON public.refund_requests (email, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_refund_requests_payment_status
    ON public.refund_requests (payment_id, status);
CREATE INDEX IF NOT EXISTS idx_refund_requests_status_created
    ON public.refund_requests (status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.refund_audit_events (
    id text PRIMARY KEY,
    refund_request_id text NOT NULL,
    payment_id text NOT NULL DEFAULT '',
    actor_email text NOT NULL DEFAULT '',
    actor_type text NOT NULL DEFAULT 'system',
    action text NOT NULL,
    safe_metadata_json text NOT NULL DEFAULT '{}',
    created_at text NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_refund_audit_request_created
    ON public.refund_audit_events (refund_request_id, created_at);

ALTER TABLE public.refund_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refund_audit_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.refund_requests FROM anon, authenticated;
REVOKE ALL ON public.refund_audit_events FROM anon, authenticated;
