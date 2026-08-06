-- Public snapshots are accessible only through the FastAPI token endpoint.
-- The backend service role may manage rows; direct anon/authenticated reads remain denied.
create table if not exists public.public_shares (
  id text primary key,
  token_hash text not null unique,
  owner_email text not null,
  resource_type text not null check (resource_type in ('material', 'chat')),
  resource_id text not null,
  title text not null default '',
  snapshot_json text not null,
  expires_at text not null default '',
  revoked_at text not null default '',
  created_at text not null,
  updated_at text not null
);

create index if not exists idx_public_shares_owner_resource
  on public.public_shares (owner_email, resource_type, resource_id, updated_at desc);

alter table public.public_shares enable row level security;
revoke all on table public.public_shares from anon, authenticated;

