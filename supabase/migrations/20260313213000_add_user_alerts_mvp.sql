begin;

create table if not exists public.user_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  alert_type text not null check (alert_type in ('deadline_due_soon', 'outcome_reminder', 'weekly_digest_ready', 'watchlist_due_soon')),
  source_id text not null,
  source_kind text not null check (source_kind in ('judgment_card', 'user_decision', 'weekly_digest')),
  episode_id uuid references public.episodes(id) on delete set null,
  title text not null,
  summary text not null,
  urgency text not null check (urgency in ('critical', 'high', 'medium', 'low')),
  due_at timestamptz,
  is_read boolean not null default false,
  is_sent boolean not null default false,
  dismissed_at timestamptz,
  alert_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_user_alerts_dedupe unique (user_id, alert_type, source_kind, source_id)
);

create index if not exists idx_user_alerts_user_due_at
  on public.user_alerts(user_id, due_at asc nulls last, created_at desc);

create index if not exists idx_user_alerts_user_unread
  on public.user_alerts(user_id, is_read, dismissed_at, created_at desc);

drop trigger if exists set_user_alerts_updated_at on public.user_alerts;
create trigger set_user_alerts_updated_at
before update on public.user_alerts
for each row
execute function public.set_current_timestamp_updated_at();

alter table public.user_alerts enable row level security;

drop policy if exists user_alerts_self_select on public.user_alerts;
create policy user_alerts_self_select
  on public.user_alerts
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists user_alerts_self_update on public.user_alerts;
create policy user_alerts_self_update
  on public.user_alerts
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

comment on table public.user_alerts is
  'Stores generated in-app alert candidates so weekly digest, outcome reminder, and future email or push delivery can share one base.';

create table if not exists public.user_notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  weekly_digest_enabled boolean not null default true,
  deadline_alert_enabled boolean not null default true,
  outcome_reminder_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_user_notification_preferences_updated_at on public.user_notification_preferences;
create trigger set_user_notification_preferences_updated_at
before update on public.user_notification_preferences
for each row
execute function public.set_current_timestamp_updated_at();

alter table public.user_notification_preferences enable row level security;

drop policy if exists user_notification_preferences_self_select on public.user_notification_preferences;
create policy user_notification_preferences_self_select
  on public.user_notification_preferences
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists user_notification_preferences_self_insert on public.user_notification_preferences;
create policy user_notification_preferences_self_insert
  on public.user_notification_preferences
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists user_notification_preferences_self_update on public.user_notification_preferences;
create policy user_notification_preferences_self_update
  on public.user_notification_preferences
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

comment on table public.user_notification_preferences is
  'Lightweight retention settings for in-app alerts, designed to expand to email or push preferences later.';

commit;
