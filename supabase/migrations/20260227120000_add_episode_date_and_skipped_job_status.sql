begin;

alter table public.episodes
  add column if not exists episode_date date;

update public.episodes
set episode_date = (published_at at time zone 'Asia/Tokyo')::date
where episode_date is null
  and published_at is not null;

create index if not exists idx_episodes_episode_date
  on public.episodes(episode_date desc);

alter table public.job_runs
  drop constraint if exists job_runs_status_check,
  add constraint job_runs_status_check check (status in ('running', 'success', 'failed', 'skipped'));

commit;
