begin;

create extension if not exists pgcrypto with schema extensions;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.episodes (
  id uuid primary key default gen_random_uuid(),
  master_id uuid references public.episodes(id) on delete restrict,
  lang text not null check (lang in ('ja', 'en')),
  status text not null default 'queued' check (status in ('queued', 'draft', 'generating', 'ready', 'failed')),
  title text,
  script text,
  audio_url text,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint episodes_master_required_for_en
    check ((lang = 'ja' and master_id is null) or (lang = 'en' and master_id is not null))
);

create unique index if not exists episodes_unique_en_per_master
  on public.episodes(master_id)
  where lang = 'en';

create index if not exists episodes_status_created_idx
  on public.episodes(status, created_at desc);

create or replace function public.assert_episode_master_is_ja()
returns trigger
language plpgsql
as $$
begin
  if new.lang = 'en' then
    perform 1
    from public.episodes master
    where master.id = new.master_id
      and master.lang = 'ja';

    if not found then
      raise exception 'English episodes must reference a Japanese master episode.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_episodes_updated_at on public.episodes;
create trigger trg_episodes_updated_at
before update on public.episodes
for each row
execute function public.set_updated_at();

drop trigger if exists trg_episodes_master_lang on public.episodes;
create trigger trg_episodes_master_lang
before insert or update of master_id, lang on public.episodes
for each row
execute function public.assert_episode_master_is_ja();

create table if not exists public.letters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  episode_id uuid references public.episodes(id) on delete set null,
  subject text,
  body text not null,
  status text not null default 'queued' check (status in ('queued', 'processed', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists letters_user_created_idx
  on public.letters(user_id, created_at desc);

drop trigger if exists trg_letters_updated_at on public.letters;
create trigger trg_letters_updated_at
before update on public.letters
for each row
execute function public.set_updated_at();

create table if not exists public.tips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  episode_id uuid references public.episodes(id) on delete set null,
  provider text not null default 'stripe',
  provider_payment_id text not null,
  provider_event_id text,
  amount integer not null check (amount > 0),
  currency text not null default 'jpy',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint tips_provider_payment_id_unique unique (provider_payment_id)
);

create index if not exists tips_episode_created_idx
  on public.tips(episode_id, created_at desc);

create table if not exists public.job_runs (
  id bigserial primary key,
  job_name text not null,
  step_name text not null,
  idempotency_key text not null,
  status text not null check (status in ('started', 'succeeded', 'failed', 'skipped')),
  episode_id uuid references public.episodes(id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  error text,
  created_at timestamptz not null default now(),
  finished_at timestamptz,
  constraint job_runs_unique_key unique (job_name, step_name, idempotency_key)
);

create index if not exists job_runs_lookup_idx
  on public.job_runs(job_name, step_name, created_at desc);

create index if not exists job_runs_episode_idx
  on public.job_runs(episode_id, created_at desc);

alter table public.episodes enable row level security;
alter table public.letters enable row level security;
alter table public.tips enable row level security;
alter table public.job_runs enable row level security;

create policy if not exists episodes_read_authenticated
  on public.episodes
  for select
  to authenticated
  using (true);

create policy if not exists letters_select_own
  on public.letters
  for select
  to authenticated
  using (user_id = auth.uid());

create policy if not exists letters_insert_own
  on public.letters
  for insert
  to authenticated
  with check (user_id = auth.uid());

create policy if not exists tips_select_own
  on public.tips
  for select
  to authenticated
  using (user_id = auth.uid());

create policy if not exists job_runs_read_authenticated
  on public.job_runs
  for select
  to authenticated
  using (true);

commit;
