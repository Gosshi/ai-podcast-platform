alter table public.trend_sources
  add column if not exists weight double precision not null default 1,
  add column if not exists category text not null default 'general';

alter table public.trend_items
  add column if not exists score double precision not null default 0,
  add column if not exists normalized_hash text null;

create unique index if not exists idx_trend_items_normalized_hash_unique
  on public.trend_items(normalized_hash)
  where normalized_hash is not null;

create index if not exists idx_trend_items_published_at_score
  on public.trend_items(published_at desc, score desc);

update public.trend_items ti
set score = greatest(
  0,
  coalesce(ts.weight, 1) * exp(
    (-ln(2) * least(
      greatest(extract(epoch from (now() - coalesce(ti.published_at, ti.created_at))), 0) / 3600,
      48
    )) / 24
  )
)
from public.trend_sources ts
where ts.id = ti.source_id
  and (ti.score is null or ti.score = 0);
