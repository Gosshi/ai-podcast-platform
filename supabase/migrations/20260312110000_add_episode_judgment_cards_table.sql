begin;

create table if not exists public.episode_judgment_cards (
  id uuid primary key default gen_random_uuid(),
  episode_id uuid not null references public.episodes(id) on delete cascade,
  lang text not null check (lang in ('ja', 'en')),
  genre text null,
  topic_order integer not null check (topic_order >= 1),
  topic_title text not null,
  frame_type text null,
  judgment_type text not null check (judgment_type in ('use_now', 'watch', 'skip')),
  judgment_summary text not null,
  action_text text null,
  deadline_at timestamptz null,
  threshold_json jsonb not null default '{}'::jsonb,
  watch_points_json jsonb not null default '[]'::jsonb,
  confidence_score numeric(4, 3) null check (confidence_score is null or (confidence_score >= 0 and confidence_score <= 1)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_episode_judgment_cards_episode_topic unique (episode_id, topic_order)
);

create index if not exists idx_episode_judgment_cards_episode_id
  on public.episode_judgment_cards(episode_id, topic_order asc);

create index if not exists idx_episode_judgment_cards_lang_genre
  on public.episode_judgment_cards(lang, genre, judgment_type);

drop trigger if exists set_episode_judgment_cards_updated_at on public.episode_judgment_cards;
create trigger set_episode_judgment_cards_updated_at
before update on public.episode_judgment_cards
for each row
execute function public.set_current_timestamp_updated_at();

insert into public.episode_judgment_cards (
  episode_id,
  lang,
  genre,
  topic_order,
  topic_title,
  frame_type,
  judgment_type,
  judgment_summary,
  action_text,
  deadline_at,
  threshold_json,
  watch_points_json,
  confidence_score
)
select
  e.id as episode_id,
  e.lang,
  e.genre,
  cards.ordinality::integer as topic_order,
  coalesce(nullif(cards.card->>'topic_title', ''), 'DeepDive ' || cards.ordinality::text) as topic_title,
  nullif(cards.card->>'frame_type', '') as frame_type,
  case
    when coalesce(cards.card->>'judgment_type', '') in ('use_now', 'watch', 'skip') then cards.card->>'judgment_type'
    when coalesce(cards.card->>'judgment', '') ~ '(見送|今使わない|買わない|契約しない|停止候補|skip)' then 'skip'
    when coalesce(cards.card->>'judgment', '') ~ '(検討継続|監視|様子見|比較|watch|monitor)' then 'watch'
    else 'use_now'
  end as judgment_type,
  coalesce(nullif(cards.card->>'judgment_summary', ''), nullif(cards.card->>'judgment', ''), 'Judgment pending') as judgment_summary,
  nullif(cards.card->>'action_text', '') as action_text,
  nullif(cards.card->>'deadline_at', '')::timestamptz as deadline_at,
  coalesce(cards.card->'threshold_json', '{}'::jsonb) as threshold_json,
  coalesce(cards.card->'watch_points_json', cards.card->'watch_points', '[]'::jsonb) as watch_points_json,
  nullif(cards.card->>'confidence_score', '')::numeric as confidence_score
from public.episodes e
cross join lateral jsonb_array_elements(coalesce(e.judgment_cards, '[]'::jsonb)) with ordinality as cards(card, ordinality)
where jsonb_typeof(coalesce(e.judgment_cards, '[]'::jsonb)) = 'array'
on conflict (episode_id, topic_order) do update
set
  lang = excluded.lang,
  genre = excluded.genre,
  topic_title = excluded.topic_title,
  frame_type = excluded.frame_type,
  judgment_type = excluded.judgment_type,
  judgment_summary = excluded.judgment_summary,
  action_text = excluded.action_text,
  deadline_at = excluded.deadline_at,
  threshold_json = excluded.threshold_json,
  watch_points_json = excluded.watch_points_json,
  confidence_score = excluded.confidence_score,
  updated_at = now();

alter table public.episode_judgment_cards enable row level security;

comment on table public.episode_judgment_cards is
  'Structured judgment cards extracted from episode DeepDive sections for reuse in feeds, weekly summaries, and decision tools.';

commit;
