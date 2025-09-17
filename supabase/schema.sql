-- AWS CloudWatch Interface baseline schema
-- Run this in Supabase SQL editor or via `psql` against your Postgres instance.

-- Extensions --------------------------------------------------------------
create extension if not exists "uuid-ossp";
create extension if not exists pgcrypto;

-- Enums ------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type user_role as enum ('admin', 'member');
  end if;
  if not exists (select 1 from pg_type where typname = 'requester_type') then
    create type requester_type as enum ('user', 'agent');
  end if;
  if not exists (select 1 from pg_type where typname = 'query_status') then
    create type query_status as enum ('pending', 'running', 'succeeded', 'failed');
  end if;
  if not exists (select 1 from pg_type where typname = 'client_status') then
    create type client_status as enum ('active', 'revoked');
  end if;
end $$;

-- Tables -----------------------------------------------------------------
create table if not exists profiles (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  display_name text,
  role user_role not null default 'member',
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists api_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  token_hash text not null,
  label text not null,
  last_used_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists saved_queries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  log_group text not null,
  query_string text not null,
  description text,
  tags text[] default array[]::text[],
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists query_history (
  id uuid primary key default gen_random_uuid(),
  requester_type requester_type not null,
  requester_id uuid references profiles(id) on delete set null,
  log_group text not null,
  query_string text not null,
  started_at timestamptz not null default timezone('utc', now()),
  completed_at timestamptz,
  status query_status not null default 'pending',
  error_message text,
  result_row_count integer,
  summary_text text,
  cloudwatch_query_id text,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists cached_results (
  id uuid primary key default gen_random_uuid(),
  query_history_id uuid not null references query_history(id) on delete cascade,
  expires_at timestamptz not null,
  result_json jsonb not null,
  result_checksum text not null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references profiles(id) on delete set null,
  event_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists mcp_clients (
  id uuid primary key default gen_random_uuid(),
  client_name text not null,
  client_public_key text not null,
  last_seen_at timestamptz,
  status client_status not null default 'active',
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists cloudwatch_logs (
  id uuid primary key default gen_random_uuid(),
  log_group text not null,
  timestamp timestamptz not null,
  message text not null,
  ingestion_label text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

-- Indexes ----------------------------------------------------------------
create index if not exists idx_saved_queries_user on saved_queries(user_id);
create index if not exists idx_saved_queries_log_group on saved_queries(log_group);

create index if not exists idx_query_history_requester on query_history(requester_type, requester_id);
create index if not exists idx_query_history_log_group on query_history(log_group);
create index if not exists idx_query_history_created_at on query_history(created_at desc);
create index if not exists idx_query_history_cloudwatch_id on query_history(cloudwatch_query_id);

create index if not exists idx_cached_results_query on cached_results(query_history_id);

create index if not exists idx_api_tokens_user on api_tokens(user_id);
create index if not exists idx_audit_events_actor on audit_events(actor_id);

create unique index if not exists idx_cloudwatch_logs_unique on cloudwatch_logs(log_group, timestamp, message);
create index if not exists idx_cloudwatch_logs_timestamp on cloudwatch_logs(timestamp);

-- Row Level Security -----------------------------------------------------
alter table profiles enable row level security;
alter table api_tokens enable row level security;
alter table saved_queries enable row level security;
alter table query_history enable row level security;
alter table cached_results enable row level security;
alter table audit_events enable row level security;
alter table mcp_clients enable row level security;
alter table cloudwatch_logs enable row level security;

-- Helper function to refresh updated_at columns
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$ language plpgsql;

create trigger if not exists update_saved_queries_updated_at
  before update on saved_queries
  for each row execute procedure update_updated_at_column();

-- Policies must be recreated when this script runs more than once
-- Profiles policies
alter table profiles force row level security;
drop policy if exists "Profiles are viewable by owner" on profiles;
create policy "Profiles are viewable by owner" on profiles
  for select using (
    auth.uid() = id
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );

drop policy if exists "Profiles updatable by owner" on profiles;
create policy "Profiles updatable by owner" on profiles
  for update using (
    auth.uid() = id
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );

drop policy if exists "Profiles insertable by authenticated" on profiles;
create policy "Profiles insertable by authenticated" on profiles
  for insert with check (
    auth.uid() = id
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- Saved queries policies
alter table saved_queries force row level security;
drop policy if exists "Saved queries are owner readable" on saved_queries;
create policy "Saved queries are owner readable" on saved_queries
  for select using (
    user_id = auth.uid()
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );

drop policy if exists "Saved queries are owner writable" on saved_queries;
create policy "Saved queries are owner writable" on saved_queries
  for all using (
    user_id = auth.uid()
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  ) with check (
    user_id = auth.uid()
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- API tokens policies
alter table api_tokens force row level security;
drop policy if exists "API tokens readable by owner" on api_tokens;
create policy "API tokens readable by owner" on api_tokens
  for select using (
    user_id = auth.uid()
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );

drop policy if exists "API tokens writable by owner" on api_tokens;
create policy "API tokens writable by owner" on api_tokens
  for all using (
    user_id = auth.uid()
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  ) with check (
    user_id = auth.uid()
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- Query history policies
alter table query_history force row level security;
drop policy if exists "Query history readable by requester" on query_history;
create policy "Query history readable by requester" on query_history
  for select using (
    (requester_type = 'user' and requester_id = auth.uid())
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );

drop policy if exists "Query history insertable by trusted roles" on query_history;
create policy "Query history insertable by trusted roles" on query_history
  for insert with check (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('admin', 'member'))
  );

drop policy if exists "Query history updatable by admins" on query_history;
create policy "Query history updatable by admins" on query_history
  for update using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- Cached results policies
alter table cached_results force row level security;
drop policy if exists "Cached results follow query history access" on cached_results;
create policy "Cached results follow query history access" on cached_results
  for select using (
    exists (
      select 1 from query_history q
      where q.id = query_history_id
        and (
          (q.requester_type = 'user' and q.requester_id = auth.uid())
          or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
        )
    )
  );

drop policy if exists "Cached results writable by service" on cached_results;
create policy "Cached results writable by service" on cached_results
  for insert with check (true);

-- Audit events policies
alter table audit_events force row level security;
drop policy if exists "Audit events readable by admins" on audit_events;
create policy "Audit events readable by admins" on audit_events
  for select using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );

drop policy if exists "Audit events writable by service" on audit_events;
create policy "Audit events writable by service" on audit_events
  for insert with check (true);

-- MCP clients policies
alter table mcp_clients force row level security;
drop policy if exists "MCP clients manageable by admins" on mcp_clients;
create policy "MCP clients manageable by admins" on mcp_clients
  for all using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  ) with check (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- Cloudwatch logs policies
alter table cloudwatch_logs force row level security;
drop policy if exists "Cloudwatch logs readable" on cloudwatch_logs;
create policy "Cloudwatch logs readable" on cloudwatch_logs
  for select using (
    auth.role() = 'service_role'
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );

drop policy if exists "Cloudwatch logs writable" on cloudwatch_logs;
create policy "Cloudwatch logs writable" on cloudwatch_logs
  for insert with check (auth.role() = 'service_role');

