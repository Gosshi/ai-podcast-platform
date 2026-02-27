begin;

alter table public.episodes
  add column if not exists genre text;

update public.episodes
set genre = 'general'
where genre is null;

alter table public.episodes
  alter column genre set default 'general';

create index if not exists idx_episodes_genre_published_at
  on public.episodes(genre, published_at desc);

create index if not exists idx_episodes_genre_episode_date
  on public.episodes(genre, episode_date desc);

commit;
