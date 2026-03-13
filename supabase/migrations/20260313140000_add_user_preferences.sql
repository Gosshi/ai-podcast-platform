begin;

create table if not exists public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  interest_topics jsonb not null default '[]'::jsonb,
  active_subscriptions jsonb not null default '[]'::jsonb,
  decision_priority text not null,
  daily_available_time text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_preferences_interest_topics_array_check check (jsonb_typeof(interest_topics) = 'array'),
  constraint user_preferences_active_subscriptions_array_check check (jsonb_typeof(active_subscriptions) = 'array'),
  constraint user_preferences_decision_priority_check check (
    decision_priority in ('save_money', 'save_time', 'discover_new', 'avoid_regret')
  ),
  constraint user_preferences_daily_available_time_check check (
    daily_available_time in ('<30min', '30-60', '1-2h', '2h+')
  )
);

drop trigger if exists set_user_preferences_updated_at on public.user_preferences;
create trigger set_user_preferences_updated_at
before update on public.user_preferences
for each row
execute function public.set_current_timestamp_updated_at();

alter table public.user_preferences enable row level security;

drop policy if exists user_preferences_self_select on public.user_preferences;
create policy user_preferences_self_select
  on public.user_preferences
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists user_preferences_self_insert on public.user_preferences;
create policy user_preferences_self_insert
  on public.user_preferences
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists user_preferences_self_update on public.user_preferences;
create policy user_preferences_self_update
  on public.user_preferences
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

commit;
