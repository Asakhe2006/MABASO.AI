-- Run this in the Supabase SQL editor for the affected project.
--
-- This app does not call Supabase directly from the browser. Supabase access is
-- backend-only through SUPABASE_SERVICE_ROLE_KEY and/or a server-side database
-- connection, so public API clients should not have direct table access.

do $$
declare
  table_name text;
  table_names text[] := array[
    'users',
    'login_codes',
    'collaboration_rooms',
    'collaboration_room_members',
    'collaboration_room_messages',
    'collaboration_room_answers',
    'sessions',
    'account_devices',
    'active_sessions',
    'subscription_abuse_events',
    'account_sharing_risk',
    'revoked_sessions',
    'study_history_items',
    'assistant_conversations',
    'assistant_messages',
    'email_password_credentials',
    'pending_email_password_registrations',
    'audit_logs',
    'admin_login_attempts',
    'user_account_states',
    'support_messages',
    'realtime_tutor_sessions',
    'request_rate_limits',
    'billing_checkout_sessions',
    'billing_subscriptions',
    'billing_events',
    'billing_payments',
    'billing_plan_features',
    'billing_usage_events',
    'payment_requests',
    'conversations',
    'messages'
  ];
  policy_role_clause text;
begin
  if exists (select 1 from pg_roles where rolname = 'anon')
    and exists (select 1 from pg_roles where rolname = 'authenticated') then
    policy_role_clause := 'anon, authenticated';
  elsif exists (select 1 from pg_roles where rolname = 'anon') then
    policy_role_clause := 'anon';
  elsif exists (select 1 from pg_roles where rolname = 'authenticated') then
    policy_role_clause := 'authenticated';
  else
    policy_role_clause := 'public';
  end if;

  foreach table_name in array table_names loop
    if to_regclass(format('public.%I', table_name)) is not null then
      execute format('alter table public.%I enable row level security', table_name);

      if exists (select 1 from pg_roles where rolname = 'anon') then
        execute format('revoke all on table public.%I from anon', table_name);
      end if;

      if exists (select 1 from pg_roles where rolname = 'authenticated') then
        execute format('revoke all on table public.%I from authenticated', table_name);
      end if;

      if exists (select 1 from pg_roles where rolname = 'service_role') then
        execute format('grant all on table public.%I to service_role', table_name);
      end if;

      if not exists (
        select 1
        from pg_policies
        where schemaname = 'public'
          and tablename = table_name
          and policyname = 'Block direct client access'
      ) then
        execute format(
          'create policy "Block direct client access" on public.%I for all to %s using (false) with check (false)',
          table_name,
          policy_role_clause
        );
      end if;
    end if;
  end loop;
end $$;

-- Optional verification after running the block above.
select
  n.nspname as schema_name,
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
  and c.relname in (
    'users',
    'login_codes',
    'collaboration_rooms',
    'collaboration_room_members',
    'collaboration_room_messages',
    'collaboration_room_answers',
    'sessions',
    'account_devices',
    'active_sessions',
    'subscription_abuse_events',
    'account_sharing_risk',
    'revoked_sessions',
    'study_history_items',
    'assistant_conversations',
    'assistant_messages',
    'email_password_credentials',
    'pending_email_password_registrations',
    'audit_logs',
    'admin_login_attempts',
    'user_account_states',
    'support_messages',
    'realtime_tutor_sessions',
    'request_rate_limits',
    'billing_checkout_sessions',
    'billing_subscriptions',
    'billing_events',
    'billing_payments',
    'billing_plan_features',
    'billing_usage_events',
    'payment_requests',
    'conversations',
    'messages'
  )
order by c.relname;
