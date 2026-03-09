begin;

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text null,
  stripe_customer_id text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_type text not null default 'pro_monthly',
  status text not null default 'inactive',
  current_period_end timestamptz null,
  stripe_customer_id text null,
  stripe_subscription_id text null,
  checkout_session_id text null,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles
  add column if not exists email text,
  add column if not exists stripe_customer_id text,
  add column if not exists created_at timestamptz,
  add column if not exists updated_at timestamptz;

alter table public.profiles
  alter column created_at set default now(),
  alter column updated_at set default now();

alter table public.subscriptions
  add column if not exists user_id uuid,
  add column if not exists plan_type text,
  add column if not exists status text,
  add column if not exists current_period_end timestamptz,
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists checkout_session_id text,
  add column if not exists cancel_at_period_end boolean,
  add column if not exists created_at timestamptz,
  add column if not exists updated_at timestamptz;

alter table public.subscriptions
  alter column plan_type set default 'pro_monthly',
  alter column status set default 'inactive',
  alter column cancel_at_period_end set default false,
  alter column created_at set default now(),
  alter column updated_at set default now();

alter table public.subscriptions
  alter column user_id set not null,
  alter column plan_type set not null,
  alter column status set not null,
  alter column cancel_at_period_end set not null;

alter table public.subscriptions
  drop constraint if exists subscriptions_status_check,
  add constraint subscriptions_status_check
    check (status in ('trialing', 'active', 'past_due', 'canceled', 'incomplete', 'incomplete_expired', 'unpaid', 'paused', 'inactive'));

create unique index if not exists uq_profiles_stripe_customer_id
  on public.profiles(stripe_customer_id)
  where stripe_customer_id is not null;

create unique index if not exists uq_subscriptions_stripe_subscription_id
  on public.subscriptions(stripe_subscription_id)
  where stripe_subscription_id is not null;

create unique index if not exists uq_subscriptions_checkout_session_id
  on public.subscriptions(checkout_session_id)
  where checkout_session_id is not null;

create index if not exists idx_subscriptions_user_id_updated_at
  on public.subscriptions(user_id, updated_at desc);

alter table public.episodes
  add column if not exists judgment_cards jsonb not null default '[]'::jsonb;

create or replace function public.set_current_timestamp_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row
execute function public.set_current_timestamp_updated_at();

drop trigger if exists set_subscriptions_updated_at on public.subscriptions;
create trigger set_subscriptions_updated_at
before update on public.subscriptions
for each row
execute function public.set_current_timestamp_updated_at();

create or replace function public.handle_auth_user_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, email)
  values (new.id, new.email)
  on conflict (user_id) do update
    set email = excluded.email,
        updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_auth_user_created();

insert into public.profiles (user_id, email)
select id, email
from auth.users
on conflict (user_id) do update
set email = excluded.email,
    updated_at = now();

alter table public.profiles enable row level security;
alter table public.subscriptions enable row level security;

drop policy if exists profiles_self_select on public.profiles;
create policy profiles_self_select
  on public.profiles
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists subscriptions_self_select on public.subscriptions;
create policy subscriptions_self_select
  on public.subscriptions
  for select
  to authenticated
  using (auth.uid() = user_id);

commit;
