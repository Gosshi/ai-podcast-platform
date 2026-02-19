alter table public.trend_items
  add column if not exists source_name text null,
  add column if not exists source_category text null,
  add column if not exists source_theme text null;

update public.trend_items ti
set
  source_name = coalesce(ti.source_name, ts.name),
  source_category = coalesce(ti.source_category, ts.category),
  source_theme = coalesce(ti.source_theme, ts.theme)
from public.trend_sources ts
where ti.source_id = ts.id
  and (
    ti.source_name is null
    or ti.source_category is null
    or ti.source_theme is null
  );

create index if not exists idx_trend_items_source_category_score
  on public.trend_items(source_category, score desc, published_at desc);
