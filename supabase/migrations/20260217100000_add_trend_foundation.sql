create table if not exists public.trend_sources (
  id uuid primary key default gen_random_uuid(),
  source_key text not null unique,
  name text not null,
  url text not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.trend_items (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.trend_sources(id) on delete cascade,
  title text not null,
  url text not null,
  summary text null,
  published_at timestamptz null,
  hash text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.trend_runs (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'running',
  fetched_count integer not null default 0,
  inserted_count integer not null default 0,
  payload jsonb not null default '{}'::jsonb,
  error text null,
  started_at timestamptz not null default now(),
  ended_at timestamptz null
);

alter table public.trend_runs
  drop constraint if exists trend_runs_status_check,
  add constraint trend_runs_status_check check (status in ('running', 'success', 'failed'));

create index if not exists idx_trend_sources_enabled on public.trend_sources(enabled);
create index if not exists idx_trend_items_created_at on public.trend_items(created_at desc);
create index if not exists idx_trend_items_source_id_created_at on public.trend_items(source_id, created_at desc);
create index if not exists idx_trend_runs_started_at on public.trend_runs(started_at desc);

alter table public.trend_sources enable row level security;
alter table public.trend_items enable row level security;
alter table public.trend_runs enable row level security;

drop policy if exists trend_sources_authenticated_select on public.trend_sources;
create policy trend_sources_authenticated_select
  on public.trend_sources
  for select
  to authenticated
  using (true);

drop policy if exists trend_sources_authenticated_insert on public.trend_sources;
create policy trend_sources_authenticated_insert
  on public.trend_sources
  for insert
  to authenticated
  with check (true);

drop policy if exists trend_sources_authenticated_update on public.trend_sources;
create policy trend_sources_authenticated_update
  on public.trend_sources
  for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists trend_items_authenticated_select on public.trend_items;
create policy trend_items_authenticated_select
  on public.trend_items
  for select
  to authenticated
  using (true);

drop policy if exists trend_items_authenticated_insert on public.trend_items;
create policy trend_items_authenticated_insert
  on public.trend_items
  for insert
  to authenticated
  with check (true);

drop policy if exists trend_runs_authenticated_select on public.trend_runs;
create policy trend_runs_authenticated_select
  on public.trend_runs
  for select
  to authenticated
  using (true);

drop policy if exists trend_runs_authenticated_insert on public.trend_runs;
create policy trend_runs_authenticated_insert
  on public.trend_runs
  for insert
  to authenticated
  with check (true);

drop policy if exists trend_runs_authenticated_update on public.trend_runs;
create policy trend_runs_authenticated_update
  on public.trend_runs
  for update
  to authenticated
  using (true)
  with check (true);
