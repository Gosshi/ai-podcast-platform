create extension if not exists pg_trgm;

alter table public.episode_judgment_cards
  add column if not exists judgment_priority smallint
  generated always as (
    case judgment_type
      when 'use_now' then 0
      when 'watch' then 1
      else 2
    end
  ) stored;

create index if not exists idx_episode_judgment_cards_topic_title_trgm
  on public.episode_judgment_cards using gin (topic_title gin_trgm_ops);

create index if not exists idx_episode_judgment_cards_judgment_summary_trgm
  on public.episode_judgment_cards using gin (judgment_summary gin_trgm_ops);

create index if not exists idx_episode_judgment_cards_library_filters
  on public.episode_judgment_cards(genre, frame_type, judgment_type, judgment_priority, deadline_at, created_at desc);
