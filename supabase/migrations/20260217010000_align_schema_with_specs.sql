begin;

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.episodes (
  id uuid primary key default gen_random_uuid(),
  lang text not null,
  master_id uuid null,
  status text not null default 'draft',
  title text null,
  description text null,
  script text null,
  audio_url text null,
  duration_sec integer null,
  published_at timestamptz null,
  created_at timestamptz not null default now()
);

alter table public.episodes
  add column if not exists lang text,
  add column if not exists master_id uuid,
  add column if not exists status text,
  add column if not exists title text,
  add column if not exists description text,
  add column if not exists script text,
  add column if not exists audio_url text,
  add column if not exists duration_sec integer,
  add column if not exists published_at timestamptz,
  add column if not exists created_at timestamptz;

alter table public.episodes
  alter column created_at set default now();

update public.episodes set status = 'published'
where status = 'ready' and published_at is not null;

alter table public.episodes
  drop constraint if exists episodes_master_id_fkey,
  add constraint episodes_master_id_fkey foreign key (master_id) references public.episodes(id);

alter table public.episodes
  drop constraint if exists episodes_lang_check,
  add constraint episodes_lang_check check (lang in ('ja', 'en'));

alter table public.episodes
  drop constraint if exists episodes_status_check,
  add constraint episodes_status_check check (status in ('draft', 'queued', 'generating', 'ready', 'published', 'failed'));

alter table public.episodes
  drop constraint if exists episodes_duration_sec_check,
  add constraint episodes_duration_sec_check check (duration_sec is null or duration_sec >= 0);

alter table public.episodes
  drop constraint if exists en_requires_master,
  add constraint en_requires_master check (
    (lang = 'ja' and master_id is null) or
    (lang = 'en' and master_id is not null)
  );

create index if not exists idx_episodes_lang_published_at on public.episodes(lang, published_at desc);
create index if not exists idx_episodes_master_id on public.episodes(master_id);
create index if not exists idx_episodes_status on public.episodes(status);

create table if not exists public.letters (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  text text not null,
  moderation_status text not null default 'pending',
  category text not null default 'other',
  summary text null,
  tip_amount integer null,
  created_at timestamptz not null default now()
);

alter table public.letters
  add column if not exists display_name text,
  add column if not exists text text,
  add column if not exists moderation_status text,
  add column if not exists category text,
  add column if not exists summary text,
  add column if not exists tip_amount integer,
  add column if not exists created_at timestamptz;

alter table public.letters
  alter column created_at set default now();

alter table public.letters
  drop constraint if exists letters_moderation_status_check,
  add constraint letters_moderation_status_check check (moderation_status in ('pending', 'ok', 'needs_review', 'reject'));

alter table public.letters
  drop constraint if exists letters_category_check,
  add constraint letters_category_check check (category in ('topic_request', 'question', 'feedback', 'other'));

alter table public.letters
  drop constraint if exists letters_tip_amount_check,
  add constraint letters_tip_amount_check check (tip_amount is null or tip_amount >= 0);

create index if not exists idx_letters_moderation_status on public.letters(moderation_status);
create index if not exists idx_letters_category_created_at on public.letters(category, created_at desc);

create table if not exists public.tips (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'stripe',
  provider_payment_id text not null,
  amount integer not null,
  currency text not null,
  letter_id uuid null,
  created_at timestamptz not null default now()
);

alter table public.tips
  add column if not exists provider text,
  add column if not exists provider_payment_id text,
  add column if not exists amount integer,
  add column if not exists currency text,
  add column if not exists letter_id uuid,
  add column if not exists created_at timestamptz;

alter table public.tips
  alter column provider set default 'stripe',
  alter column created_at set default now();

alter table public.tips
  drop constraint if exists tips_amount_check,
  add constraint tips_amount_check check (amount >= 0);

alter table public.tips
  drop constraint if exists tips_letter_id_fkey,
  add constraint tips_letter_id_fkey foreign key (letter_id) references public.letters(id);

create unique index if not exists uq_tips_provider_payment_id on public.tips(provider_payment_id);
create index if not exists idx_tips_created_at on public.tips(created_at desc);
create index if not exists idx_tips_letter_id on public.tips(letter_id);

create table if not exists public.job_runs (
  id uuid primary key default gen_random_uuid(),
  job_type text not null,
  status text not null default 'running',
  payload jsonb not null default '{}'::jsonb,
  error text null,
  started_at timestamptz not null default now(),
  ended_at timestamptz null
);

alter table public.job_runs
  add column if not exists job_type text,
  add column if not exists status text,
  add column if not exists payload jsonb,
  add column if not exists error text,
  add column if not exists started_at timestamptz,
  add column if not exists ended_at timestamptz;

alter table public.job_runs
  alter column status set default 'running',
  alter column payload set default '{}'::jsonb,
  alter column started_at set default now();

alter table public.job_runs
  drop constraint if exists job_runs_status_check,
  add constraint job_runs_status_check check (status in ('running', 'success', 'failed'));

create index if not exists idx_job_runs_job_type_started_at on public.job_runs(job_type, started_at desc);

alter table public.episodes enable row level security;
alter table public.letters enable row level security;
alter table public.tips enable row level security;
alter table public.job_runs enable row level security;

drop policy if exists episodes_anon_published_read on public.episodes;
create policy episodes_anon_published_read
  on public.episodes
  for select
  to anon
  using (status = 'published' and published_at is not null);

drop policy if exists episodes_authenticated_select on public.episodes;
create policy episodes_authenticated_select
  on public.episodes
  for select
  to authenticated
  using (true);

drop policy if exists episodes_authenticated_insert on public.episodes;
create policy episodes_authenticated_insert
  on public.episodes
  for insert
  to authenticated
  with check (true);

drop policy if exists episodes_authenticated_update on public.episodes;
create policy episodes_authenticated_update
  on public.episodes
  for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists episodes_authenticated_delete on public.episodes;
create policy episodes_authenticated_delete
  on public.episodes
  for delete
  to authenticated
  using (true);

drop policy if exists letters_authenticated_select on public.letters;
create policy letters_authenticated_select
  on public.letters
  for select
  to authenticated
  using (true);

drop policy if exists letters_authenticated_insert on public.letters;
create policy letters_authenticated_insert
  on public.letters
  for insert
  to authenticated
  with check (true);

drop policy if exists letters_authenticated_update on public.letters;
create policy letters_authenticated_update
  on public.letters
  for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists letters_authenticated_delete on public.letters;
create policy letters_authenticated_delete
  on public.letters
  for delete
  to authenticated
  using (true);

drop policy if exists tips_authenticated_select on public.tips;
create policy tips_authenticated_select
  on public.tips
  for select
  to authenticated
  using (true);

drop policy if exists tips_authenticated_insert on public.tips;
create policy tips_authenticated_insert
  on public.tips
  for insert
  to authenticated
  with check (true);

drop policy if exists tips_authenticated_update on public.tips;
create policy tips_authenticated_update
  on public.tips
  for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists tips_authenticated_delete on public.tips;
create policy tips_authenticated_delete
  on public.tips
  for delete
  to authenticated
  using (true);

drop policy if exists job_runs_authenticated_select on public.job_runs;
create policy job_runs_authenticated_select
  on public.job_runs
  for select
  to authenticated
  using (true);

drop policy if exists job_runs_authenticated_insert on public.job_runs;
create policy job_runs_authenticated_insert
  on public.job_runs
  for insert
  to authenticated
  with check (true);

drop policy if exists job_runs_authenticated_update on public.job_runs;
create policy job_runs_authenticated_update
  on public.job_runs
  for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists job_runs_authenticated_delete on public.job_runs;
create policy job_runs_authenticated_delete
  on public.job_runs
  for delete
  to authenticated
  using (true);

commit;
