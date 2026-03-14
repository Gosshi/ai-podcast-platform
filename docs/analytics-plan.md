# Product Analytics Foundation

## Goal
- 勘ではなくデータでプロダクト改善を進めるために、conversion / engagement / retention の基礎イベントを継続記録する
- free / paid / anonymous を最低限切り分ける
- 将来 PostHog などへ移行しても、イベント名とプロパティ設計を再利用できるようにする

## Storage
- Default: Supabase `public.analytics_events`
- Columns:
  - `user_id`
  - `anonymous_id`
  - `event_name`
  - `page`
  - `source`
  - `is_paid`
  - `event_properties`
  - `created_at`
- Ingestion:
  - client: `/api/analytics/track`
  - server: `src/lib/analytics/server.ts`

## Event Properties
- Common:
  - `page`
  - `source`
  - `timestamp`
- Optional dimensions:
  - `episode_id`
  - `judgment_card_id`
  - `genre`
  - `frame_type`
  - `judgment_type`
  - `decision_id`
  - `outcome`
  - `plan_type`

## Event Coverage
- Page:
  - `page_view`
  - `decisions_view`
  - `decisions_intro_impression`
  - `episodes_view`
  - `history_view`
  - `weekly_digest_view`
  - `account_view`
- Judgment cards:
  - `judgment_card_impression`
  - `judgment_card_click`
  - `judgment_card_expand`
  - `judgment_card_locked_cta_click`
- Calculator:
  - `decision_calculator_open`
  - `decision_calculator_submit`
  - `decision_calculator_result_view`
- Decision history:
  - `decision_save`
  - `decision_remove`
  - `outcome_update`
  - `outcome_reminder_impression`
  - `outcome_reminder_click`
  - `outcome_quick_submit`
  - `outcome_reminder_to_replay_click`
- Recommendation:
  - `next_best_decision_impression`
  - `next_best_decision_click`
- Monetization:
  - `paywall_view`
  - `subscribe_cta_click`
  - `checkout_started`
  - `checkout_completed`
  - `billing_portal_open`
- Retention:
  - `weekly_digest_open`
  - `weekly_digest_item_click`

## How To Read It
- conversion:
  - compare `paywall_view`, `subscribe_cta_click`, `checkout_started`, `checkout_completed`
  - slice by `page`, `source`, `is_paid`
- engagement:
  - watch `judgment_card_click`, `decision_calculator_result_view`, `decision_save`
  - compare `/decisions` vs `/episodes` usage
- retention:
  - watch `weekly_digest_open`, `weekly_digest_item_click`, `outcome_reminder_impression`, `outcome_quick_submit`, `outcome_update`
  - use `user_id` cohorts later when event volume grows
- monetization drivers:
  - compare which `source` values produce more `subscribe_cta_click`
  - compare free users who saw calculator lock vs dashboard paywall

## Verification
1. Open `/decisions` and confirm `page_view`, `decisions_view`, `decisions_intro_impression`
2. Inspect a judgment card and confirm `judgment_card_impression`
3. Open calculator and run a recalculation to confirm calculator events
4. Save a decision, confirm reminder impression, and quick-submit an outcome
5. Open reminder links to History / Replay and confirm click events
6. Open `/weekly-decisions` and click a digest item
7. Click subscribe CTA, start checkout, complete Stripe webhook
8. Open `/admin/analytics` and confirm counts move

## Manual SQL
```sql
select
  page,
  count(*) as page_views
from public.analytics_events
where event_name = 'page_view'
  and created_at >= now() - interval '30 days'
group by 1
order by 2 desc;
```

```sql
select
  source,
  count(*) filter (where event_name = 'subscribe_cta_click') as subscribe_clicks,
  count(*) filter (where event_name = 'checkout_started') as checkout_started,
  count(*) filter (where event_name = 'checkout_completed') as checkout_completed
from public.analytics_events
where created_at >= now() - interval '30 days'
group by 1
order by checkout_completed desc nulls last;
```

```sql
select
  is_paid,
  count(*) filter (where event_name = 'judgment_card_click') as judgment_clicks,
  count(*) filter (where event_name = 'decision_save') as decision_saves,
  count(*) filter (where event_name = 'weekly_digest_open') as weekly_digest_opens
from public.analytics_events
where created_at >= now() - interval '30 days'
group by 1
order by 1;
```
