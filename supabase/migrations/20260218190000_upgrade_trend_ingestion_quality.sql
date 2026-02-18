alter table public.trend_sources
  add column if not exists theme text null;

alter table public.trend_items
  add column if not exists normalized_url text null,
  add column if not exists normalized_title_hash text null,
  add column if not exists cluster_key text null,
  add column if not exists cluster_size integer not null default 1,
  add column if not exists is_cluster_representative boolean not null default true,
  add column if not exists published_at_source text not null default 'rss',
  add column if not exists published_at_fallback timestamptz null;

update public.trend_items
set
  normalized_url = coalesce(
    normalized_url,
    lower(regexp_replace(split_part(coalesce(url, ''), '#', 1), '/+$', ''))
  ),
  normalized_title_hash = coalesce(
    normalized_title_hash,
    encode(
      digest(
        lower(regexp_replace(coalesce(title, ''), '[[:punct:][:space:]]+', '', 'g')),
        'sha256'
      ),
      'hex'
    )
  ),
  normalized_hash = coalesce(
    normalized_hash,
    encode(
      digest(
        lower(regexp_replace(coalesce(title, ''), '[[:punct:][:space:]]+', '', 'g')),
        'sha256'
      ),
      'hex'
    )
  ),
  cluster_size = greatest(coalesce(cluster_size, 1), 1),
  is_cluster_representative = coalesce(is_cluster_representative, true),
  published_at = coalesce(published_at, created_at, now()),
  published_at_source = case
    when coalesce(published_at, created_at) is null then 'fetched'
    else coalesce(published_at_source, 'rss')
  end,
  published_at_fallback = case
    when coalesce(published_at_source, 'rss') = 'fetched' then coalesce(published_at_fallback, created_at, now())
    else published_at_fallback
  end;

delete from public.trend_items old_item
using public.trend_items keep_item
where old_item.id < keep_item.id
  and coalesce(old_item.normalized_url, '') = coalesce(keep_item.normalized_url, '')
  and coalesce(old_item.normalized_title_hash, '') = coalesce(keep_item.normalized_title_hash, '')
  and coalesce(old_item.normalized_url, '') <> ''
  and coalesce(old_item.normalized_title_hash, '') <> '';

drop index if exists idx_trend_items_normalized_hash_unique;

create unique index if not exists idx_trend_items_normalized_url_title_unique
  on public.trend_items(normalized_url, normalized_title_hash)
  where normalized_url is not null and normalized_title_hash is not null;

create index if not exists idx_trend_items_cluster_representative_score
  on public.trend_items(is_cluster_representative, score desc, published_at desc);

create index if not exists idx_trend_items_cluster_key
  on public.trend_items(cluster_key);

alter table public.trend_items
  drop constraint if exists trend_items_published_at_source_check;

alter table public.trend_items
  add constraint trend_items_published_at_source_check
  check (published_at_source in ('rss', 'meta', 'fetched'));
