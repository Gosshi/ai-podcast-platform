create table if not exists public.admin_access_attempts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  failed_attempts integer not null default 0 check (failed_attempts >= 0),
  locked_until timestamptz null,
  last_failed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.admin_access_attempts enable row level security;

drop trigger if exists set_admin_access_attempts_updated_at on public.admin_access_attempts;
create trigger set_admin_access_attempts_updated_at
before update on public.admin_access_attempts
for each row
execute function public.set_current_timestamp_updated_at();
