begin;

alter table public.user_preferences
  add column if not exists budget_sensitivity text;

update public.user_preferences
set daily_available_time = case daily_available_time
  when '<30min' then 'under_30m'
  when '30-60' then '30_to_60m'
  when '1-2h' then '1_to_2h'
  when '2h+' then 'over_2h'
  else daily_available_time
end;

alter table public.user_preferences
  drop constraint if exists user_preferences_daily_available_time_check,
  add constraint user_preferences_daily_available_time_check check (
    daily_available_time in ('under_30m', '30_to_60m', '1_to_2h', 'over_2h')
  );

alter table public.user_preferences
  drop constraint if exists user_preferences_budget_sensitivity_check,
  add constraint user_preferences_budget_sensitivity_check check (
    budget_sensitivity is null or budget_sensitivity in ('low', 'medium', 'high')
  );

commit;
