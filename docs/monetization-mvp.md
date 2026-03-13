# Monetization MVP

## Scope
- 最小の free / paid 判定
- Stripe 月額サブスク (`pro_monthly`)
- `/account` の購読管理UX改善
- Stripe Billing Portal のセルフサービス導線
- `/episodes` での無料 / 有料境界
- 判断カード抽出と保存
- Personal Decision Profile と personal hint
- `/decisions` の Next Best Decision ranking

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
  - 最新1週間
  - 音声再生
  - judgment summary
  - `/decisions` の一般優先判断 preview
  - `/account` で free 状態と upgrade 導線を確認
  - `/history` で件数上限つきの profile 集計
- Paid:
  - `/decisions` の personal な優先判断を複数表示
  - action_text / deadline_at / watch_points / threshold
  - DeepDive 完全版
  - 過去アーカイブ
  - `/account` で current_period_end / 支払い状態 / Billing Portal 導線を確認
  - `/history` で無制限の Personal Decision Profile
  - judgment card 上の personal hint

## Gating Direction
- 件数制限よりも「判断の深さ」で無料 / 有料を分ける
- 無料版:
  - 最新1週間の `/episodes` と `/decisions`
  - `/weekly-decisions` の一部 preview
  - judgment_summary
- 有料版:
  - action_text
  - deadline_at
  - watch_points
  - threshold_json の表示
  - Personal Decision Profile の全文集計
  - judgment card の personal hint
  - DeepDive 完全版
  - 過去アーカイブ

## Weekly Decision Digest
- `/weekly-decisions` で直近7日間の judgment cards を `use_now / watch / skip` ごとに集計する
- free:
  - カテゴリごとに一部 preview
  - judgment summary 中心
- paid:
  - 全件表示
  - deadline 付き一覧
- `genre / frame_type` breakdown を保持し、週次メール / 通知 / archive への再利用を前提にする

## Personal Decision Profile
- 目的:
  - 履歴保存を「あとで見るだけ」で終わらせず、自分の判断傾向を次の card selection に返す
  - paid の継続理由を「判断精度が上がるプロダクト」に寄せる
- source:
  - `user_decisions`
  - `episode_judgment_cards`
- rules-based insight 例:
  - 特定 frame で success が高い
  - 特定 genre / threshold 条件で regret が多い
  - 特定 genre で `use_now` が多い
  - `watch` の結果が regret に寄りやすい
- guardrails:
  - 総履歴5件未満では insight を抑制
  - frame / genre / threshold ごと3件未満では断定しない
- next step:
  - recommendation ranking
  - next best decision
  - reminder / weekly digest personalization

## Next Best Decision
- source:
  - `episode_judgment_cards`
  - `user_decisions`
  - Personal Decision Profile
- default rules:
  - `deadline_at` が近いものを優先
  - `judgment_type='use_now'` を優先
  - `judgment_type='watch'` かつ期限付きは次点
  - `skip` は低優先
- paid adjustments:
  - regret が多い `frame_type` を引き上げて後悔防止タグを返す
  - success が高い `genre` を引き上げて満足率タグを返す
  - regret が多い threshold signal を含む card を注意表示する
- output:
  - `priority_score`
  - `reason_tags`
  - `recommended_action`
  - `urgency_level`
- future reuse:
  - reminder / 週次おすすめ判断 / メール配信 / Next Best Action

## Stripe Flow
1. ログイン済みユーザーが `POST /api/stripe/subscription-checkout`
2. Stripe Checkout で subscription 開始
3. Checkout 成功後は `/account?subscription=success&session_id={CHECKOUT_SESSION_ID}` に戻す
4. `checkout.session.completed` で customer / subscription の初回紐付け
5. `customer.subscription.updated` で `subscriptions` を upsert
6. `/account` と `/episodes` が paid として再描画

## Account UX
- free / paid をバッジで即判別できる
- 表示項目:
  - プラン名
  - ステータス
  - current_period_end
  - 支払い状態
- paid ユーザーは `POST /api/stripe/billing-portal` から Billing Portal を開き、支払い方法更新や解約確認をセルフサービスで行う
- Checkout 直後は webhook 反映前でも `/account` に成功メッセージを表示し、使える機能を明示する

## Follow-up Candidates
- trial / annual plan
- weekly digest の会員限定配信
- judgment card archive / search
- profile を使った recommendation / next best decision
