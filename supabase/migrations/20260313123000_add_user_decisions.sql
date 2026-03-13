begin;

create table if not exists public.user_decisions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  judgment_card_id uuid not null references public.episode_judgment_cards(id) on delete cascade,
  episode_id uuid not null references public.episodes(id) on delete cascade,
  decision_type text not null check (decision_type in ('use_now', 'watch', 'skip')),
  outcome text not null default 'neutral' check (outcome in ('success', 'regret', 'neutral')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_user_decisions_user_card unique (user_id, judgment_card_id)
);

create index if not exists idx_user_decisions_user_created_at
  on public.user_decisions(user_id, created_at desc);

create index if not exists idx_user_decisions_episode_created_at
  on public.user_decisions(episode_id, created_at desc);

drop trigger if exists set_user_decisions_updated_at on public.user_decisions;
create trigger set_user_decisions_updated_at
before update on public.user_decisions
for each row
execute function public.set_current_timestamp_updated_at();

alter table public.user_decisions enable row level security;

drop policy if exists user_decisions_self_select on public.user_decisions;
create policy user_decisions_self_select
  on public.user_decisions
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists user_decisions_self_insert on public.user_decisions;
create policy user_decisions_self_insert
  on public.user_decisions
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists user_decisions_self_update on public.user_decisions;
create policy user_decisions_self_update
  on public.user_decisions
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

comment on table public.user_decisions is
  'Tracks which judgment cards each user adopted and the outcome they later recorded for personal decision learning.';

commit;
