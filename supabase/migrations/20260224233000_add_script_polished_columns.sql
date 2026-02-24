begin;

alter table public.episodes
  add column if not exists script_polished text,
  add column if not exists script_polished_preview text;

commit;
