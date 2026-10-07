-- Additive migration for independently tracked refund notification delivery.
-- Refund creation must remain successful even when email delivery is unavailable.

ALTER TABLE public.refund_requests
    ADD COLUMN IF NOT EXISTS admin_notification_status text NOT NULL DEFAULT 'pending',
    ADD COLUMN IF NOT EXISTS admin_notification_error text NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS admin_notified_at text NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS customer_notification_status text NOT NULL DEFAULT 'pending',
    ADD COLUMN IF NOT EXISTS customer_notification_error text NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS customer_notified_at text NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_refund_requests_status_created
    ON public.refund_requests (status, created_at DESC);
