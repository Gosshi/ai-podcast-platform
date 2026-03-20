drop index if exists public.uq_subscriptions_stripe_subscription_id;
drop index if exists public.uq_subscriptions_checkout_session_id;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.subscriptions'::regclass
      and conname = 'subscriptions_stripe_subscription_id_key'
  ) then
    alter table public.subscriptions
      add constraint subscriptions_stripe_subscription_id_key
      unique (stripe_subscription_id);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.subscriptions'::regclass
      and conname = 'subscriptions_checkout_session_id_key'
  ) then
    alter table public.subscriptions
      add constraint subscriptions_checkout_session_id_key
      unique (checkout_session_id);
  end if;
end
$$;
