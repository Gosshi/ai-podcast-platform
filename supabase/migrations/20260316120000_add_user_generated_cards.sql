begin;

create table if not exists public.user_generated_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  input_text text not null,
  lang text not null default 'ja' check (lang in ('ja', 'en')),
  genre text null,
  topic_order integer not null default 1 check (topic_order >= 1),
  topic_title text not null,
  frame_type text null,
  judgment_type text not null check (judgment_type in ('use_now', 'watch', 'skip')),
  judgment_summary text not null,
  action_text text null,
  deadline_at timestamptz null,
  threshold_json jsonb not null default '{}'::jsonb,
  watch_points_json jsonb not null default '[]'::jsonb,
  confidence_score numeric(4, 3) null check (confidence_score is null or (confidence_score >= 0 and confidence_score <= 1)),
  outcome text null check (outcome is null or outcome in ('success', 'regret', 'neutral')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_user_generated_cards_user_created_at
  on public.user_generated_cards(user_id, created_at desc);

drop trigger if exists set_user_generated_cards_updated_at on public.user_generated_cards;
create trigger set_user_generated_cards_updated_at
before update on public.user_generated_cards
for each row
execute function public.set_current_timestamp_updated_at();

alter table public.user_generated_cards enable row level security;

drop policy if exists user_generated_cards_self_select on public.user_generated_cards;
create policy user_generated_cards_self_select
  on public.user_generated_cards for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists user_generated_cards_self_insert on public.user_generated_cards;
create policy user_generated_cards_self_insert
  on public.user_generated_cards for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists user_generated_cards_self_update on public.user_generated_cards;
create policy user_generated_cards_self_update
  on public.user_generated_cards for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

comment on table public.user_generated_cards is
  'AI-generated judgment cards created from user-submitted dilemmas via OpenAI API.';

commit;
