begin;

alter table public.episodes
  add column if not exists script_score numeric,
  add column if not exists script_score_detail jsonb;

commit;
