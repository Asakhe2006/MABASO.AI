-- Additive production migration for durable background chat state and safe
-- admin diagnostics. These tables contain operational metadata, never prompts,
-- full AI answers, cookies, OAuth tokens, payment secrets, or passwords.

CREATE TABLE IF NOT EXISTS public.assistant_generation_states (
    generation_id text PRIMARY KEY,
    user_email text NOT NULL,
    conversation_id text NOT NULL DEFAULT '',
    user_message_id text NOT NULL DEFAULT '',
    assistant_message_id text NOT NULL DEFAULT '',
    request_id text NOT NULL DEFAULT '',
    status text NOT NULL DEFAULT 'queued',
    activity_type text NOT NULL DEFAULT 'REQUEST_RECEIVED',
    activity_json text NOT NULL DEFAULT '{}',
    answer_preview text NOT NULL DEFAULT '',
    has_unseen_response integer NOT NULL DEFAULT 0,
    started_at text NOT NULL,
    updated_at text NOT NULL,
    completed_at text NOT NULL DEFAULT '',
    error_code text NOT NULL DEFAULT ''
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_assistant_generation_user_request
    ON public.assistant_generation_states (user_email, request_id);
CREATE INDEX IF NOT EXISTS idx_assistant_generation_conversation_updated
    ON public.assistant_generation_states (user_email, conversation_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.diagnostic_events (
    id text PRIMARY KEY,
    trace_id text NOT NULL DEFAULT '',
    request_id text NOT NULL DEFAULT '',
    user_email text NOT NULL DEFAULT '',
    category text NOT NULL DEFAULT '',
    event_type text NOT NULL DEFAULT '',
    severity text NOT NULL DEFAULT 'INFO',
    endpoint text NOT NULL DEFAULT '',
    http_status integer NOT NULL DEFAULT 0,
    duration_ms integer NOT NULL DEFAULT 0,
    safe_message text NOT NULL DEFAULT '',
    metadata_json text NOT NULL DEFAULT '{}',
    created_at text NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_diagnostic_events_created
    ON public.diagnostic_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_diagnostic_events_user_created
    ON public.diagnostic_events (user_email, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_diagnostic_events_trace
    ON public.diagnostic_events (trace_id, created_at ASC);

ALTER TABLE public.assistant_generation_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diagnostic_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.assistant_generation_states FROM anon, authenticated;
REVOKE ALL ON public.diagnostic_events FROM anon, authenticated;
