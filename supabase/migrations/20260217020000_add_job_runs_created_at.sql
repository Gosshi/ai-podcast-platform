alter table public.job_runs
  add column if not exists created_at timestamptz;

update public.job_runs
set created_at = coalesce(created_at, started_at, now())
where created_at is null;

alter table public.job_runs
  alter column created_at set default now(),
  alter column created_at set not null;

create index if not exists idx_job_runs_created_at
  on public.job_runs(created_at desc);
