alter table public.analytics_events enable row level security;

comment on table public.analytics_events is
  'Analytics event sink. RLS is enabled so PostgREST-exposed access stays closed; service-role jobs remain able to write and read.';
