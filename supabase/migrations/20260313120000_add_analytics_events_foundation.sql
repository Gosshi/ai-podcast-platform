create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null references auth.users(id) on delete set null,
  anonymous_id text null,
  event_name text not null,
  page text null,
  source text null,
  is_paid boolean not null default false,
  event_properties jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  constraint analytics_events_identity_check check (user_id is not null or anonymous_id is not null)
);

create index if not exists analytics_events_event_name_created_at_idx
  on public.analytics_events(event_name, created_at desc);

create index if not exists analytics_events_page_created_at_idx
  on public.analytics_events(page, created_at desc);

create index if not exists analytics_events_user_id_created_at_idx
  on public.analytics_events(user_id, created_at desc)
  where user_id is not null;

create index if not exists analytics_events_anonymous_id_created_at_idx
  on public.analytics_events(anonymous_id, created_at desc)
  where anonymous_id is not null;
