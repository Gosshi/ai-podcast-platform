# Monetization MVP

## Scope
- 最小の free / paid 判定
- Stripe 月額サブスク (`pro_monthly`)
- `/episodes` での無料 / 有料境界
- 判断カード抽出と保存

## Data Model
- `profiles`
  - Supabase Auth user と 1:1
  - `stripe_customer_id` を保持
- `subscriptions`
  - `user_id`
  - `plan_type`
  - `status`
  - `current_period_end`
  - `stripe_customer_id`
  - `stripe_subscription_id`
  - `checkout_session_id`
- `episodes.judgment_cards`
  - `topic_title`
  - `judgment`
  - `deadline`
  - `watch_points`
  - `frame_type`

## Entitlement Rule
- `subscriptions.status in ('trialing', 'active', 'past_due')` のとき `paid`
- それ以外は `free`

## Judgment Card Extraction
- 入力元: `script_polished` を優先、なければ `script`
- 対象: `DEEPDIVE 1-3`
- 抽出項目:
  - `5. 今日の判断（個人視点）`
  - `6. 判断期限（個人の行動期限）`
  - `7. 監視ポイント（個人が見るべき数値）`
- 抽出失敗時も episode 生成は止めず、`[]` を許容

## UI Boundary
- Free:
  - 最新プレビュー
  - 音声再生
  - 一覧導線
- Paid:
  - 判断カード
  - DeepDive 完全版
  - 過去アーカイブ

## Stripe Flow
1. ログイン済みユーザーが `POST /api/stripe/subscription-checkout`
2. Stripe Checkout で subscription 開始
3. `checkout.session.completed` で customer / subscription の初回紐付け
4. `customer.subscription.updated` で `subscriptions` を upsert
5. `/account` と `/episodes` が paid として再描画

## Follow-up Candidates
- billing portal
- trial / annual plan
- weekly digest の会員限定配信
- judgment card archive / search
