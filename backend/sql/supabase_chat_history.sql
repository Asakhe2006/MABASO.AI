create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.conversations (
  id text primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  user_email text not null,
  title text not null default '',
  lecture_label text not null default '',
  context_key text not null default '',
  preview_text text not null default '',
  last_message_preview text not null default '',
  memory_summary text not null default '',
  search_document text not null default '',
  message_count integer not null default 0,
  is_archived boolean not null default false,
  is_pinned boolean not null default false,
  metadata_json jsonb not null default '{}'::jsonb,
  last_message_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.messages (
  id text primary key,
  conversation_id text not null references public.conversations(id) on delete cascade,
  user_email text not null,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  interaction_mode text not null default 'text',
  provider text not null default '',
  model text not null default '',
  metadata_json jsonb not null default '{}'::jsonb,
  timestamp timestamptz not null default timezone('utc', now())
);

create index if not exists idx_conversations_user_updated
  on public.conversations (user_email, is_archived, is_pinned, updated_at desc);

create index if not exists idx_conversations_last_message_at
  on public.conversations (user_email, last_message_at desc);

create index if not exists idx_messages_conversation_timestamp
  on public.messages (conversation_id, timestamp desc, id desc);

create index if not exists idx_messages_user_conversation
  on public.messages (user_email, conversation_id);

create index if not exists idx_conversations_search_document_trgm
  on public.conversations using gin (search_document gin_trgm_ops);

alter table public.users enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;

do $$
declare
  table_name text;
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

  foreach table_name in array array['users', 'conversations', 'messages'] loop
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
  end loop;
end $$;
