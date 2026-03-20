create table if not exists public.account_security_notification_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  last_login_notified_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.account_security_notification_state enable row level security;

drop trigger if exists set_account_security_notification_state_updated_at on public.account_security_notification_state;
create trigger set_account_security_notification_state_updated_at
before update on public.account_security_notification_state
for each row
execute function public.set_current_timestamp_updated_at();
