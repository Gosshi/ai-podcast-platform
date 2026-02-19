alter table public.trend_items
  add column if not exists score_freshness double precision not null default 0,
  add column if not exists score_source double precision not null default 0,
  add column if not exists score_bonus double precision not null default 0,
  add column if not exists score_penalty double precision not null default 0;

update public.trend_items
set
  score_source = case
    when score_source = 0 and score <> 0 then score
    else score_source
  end,
  score_freshness = coalesce(score_freshness, 0),
  score_bonus = coalesce(score_bonus, 0),
  score_penalty = coalesce(score_penalty, 0)
where score is not null;

create index if not exists idx_trend_items_score_breakdown
  on public.trend_items(score desc, score_freshness desc, score_bonus desc);
