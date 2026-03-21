create table if not exists public.admin_access_challenges (
  user_id uuid primary key references auth.users(id) on delete cascade,
  code_hash text null,
  expires_at timestamptz not null,
  sent_at timestamptz not null default now(),
  consumed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.admin_access_challenges enable row level security;

drop trigger if exists set_admin_access_challenges_updated_at on public.admin_access_challenges;
create trigger set_admin_access_challenges_updated_at
before update on public.admin_access_challenges
for each row
execute function public.set_current_timestamp_updated_at();
