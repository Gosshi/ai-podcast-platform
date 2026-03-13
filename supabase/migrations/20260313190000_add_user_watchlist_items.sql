begin;

create table if not exists public.user_watchlist_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  judgment_card_id uuid not null references public.episode_judgment_cards(id) on delete cascade,
  episode_id uuid not null references public.episodes(id) on delete cascade,
  status text not null check (status in ('saved', 'watching', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_user_watchlist_items_user_card unique (user_id, judgment_card_id)
);

create index if not exists idx_user_watchlist_items_user_created_at
  on public.user_watchlist_items(user_id, created_at desc);

create index if not exists idx_user_watchlist_items_user_status_created_at
  on public.user_watchlist_items(user_id, status, created_at desc);

create index if not exists idx_user_watchlist_items_episode_created_at
  on public.user_watchlist_items(episode_id, created_at desc);

drop trigger if exists set_user_watchlist_items_updated_at on public.user_watchlist_items;
create trigger set_user_watchlist_items_updated_at
before update on public.user_watchlist_items
for each row
execute function public.set_current_timestamp_updated_at();

alter table public.user_watchlist_items enable row level security;

drop policy if exists user_watchlist_items_self_select on public.user_watchlist_items;
create policy user_watchlist_items_self_select
  on public.user_watchlist_items
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists user_watchlist_items_self_insert on public.user_watchlist_items;
create policy user_watchlist_items_self_insert
  on public.user_watchlist_items
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists user_watchlist_items_self_update on public.user_watchlist_items;
create policy user_watchlist_items_self_update
  on public.user_watchlist_items
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists user_watchlist_items_self_delete on public.user_watchlist_items;
create policy user_watchlist_items_self_delete
  on public.user_watchlist_items
  for delete
  to authenticated
  using (auth.uid() = user_id);

comment on table public.user_watchlist_items is
  'Tracks judgment cards users want to revisit later without marking them as adopted decisions.';

commit;
