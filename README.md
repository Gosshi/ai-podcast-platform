# ai-podcast-platform

個人の時間とお金の最適化を支援する、意思決定支援型 AI Podcast Platform です。

## Product Concept
- ブランド: `15分で、今日の“時間単価と支出効率”を決めるニュース`
- 提供価値: 解説ではなく、個人が「今日どう行動するか」を決める判断支援
- 対象: 忙しい社会人 / サブスク整理層 / エンタメに時間を使いすぎたくない人
- 判断モデル: [Decision Framework Models](docs/decision-framework.md)

## Stack
- Next.js (App Router)
- TypeScript
- ESLint
- Supabase CLI (local project scaffold)

## Setup
1. `.env.example` を参考に `.env.local` を作成
2. 依存関係をインストール: `npm ci`
3. 開発サーバー起動: `npm run dev -- --hostname 0.0.0.0`
4. Supabase ローカル起動: `supabase start`
5. Supabase ローカル設定を確認: `supabase status`
6. Migration 適用: `supabase db reset --local --yes`

## Paid Membership MVP
- 会員状態は `profiles` と `subscriptions` で管理します
- `free` / `paid` 判定は `subscriptions.status` が `trialing | active | past_due` かどうかで決まります
- `/account` ではプラン名、購読ステータス、次回更新日、支払い状態を見やすく表示します
- `/onboarding` と `user_preferences` で explicit preference を保存し、cold start 時の personalisation seed を作ります
- `/episodes` は無料版では最新プレビューのみ、有料版では判断カード・DeepDive全文・アーカイブを表示します
- 判断カードは `episode_judgment_cards` に構造化保存され、`write-script-ja` / `expand-script-ja` / `polish-script-ja` の各 step で再抽出・同期されます
- `episode_judgment_cards` は weekly summary / 再判定ツール / 履歴分析の共通データソースです
- `user_decisions` と `/history` を使って Personal Decision Profile を集計し、履歴保存を「次の判断に返す学習ループ」に変えます
- paid は judgment card 上で frame / genre / threshold ベースの personal hint を返し、free は履歴保存上限つきで profile を育てます
- `/decisions` は Next Best Decision を最上段に表示し、締切・judgment type・personal profile を使って「今日先に見るべき判断」を返します
- `/decisions/library` は Decision Library として `episode_judgment_cards` を横断検索し、再訪・比較できる状態を作ります
- Decision Library は Replay / Saved Decisions / Alerts に接続する基盤で、episode 起点ではなく judgment 起点の再利用面を担当します
- `/watchlist` は Saved Decisions / Watchlist として、まだ採用していない judgment card を `saved / watching / archived` で保留管理します
- Watchlist は Decision History の手前にある中間レイヤーで、deadline / urgency / alerts / replay 導線の土台を担当します
- Outcome Reminder は `user_decisions` の未記録 outcome を抽出し、判断 → 結果 → 学習のループを `/decisions` と `/history` 上で閉じます
- `/history/replay/[id]` は Decision Replay として、当時の judgment card と outcome を並べて学び直せる詳細ページです
- 購読中ユーザーは Stripe Billing Portal から支払い方法更新、解約、購読管理をセルフサービスで行います
- `/weekly-decisions` で直近7日間の judgment digest を閲覧できます

## User Onboarding And Preference Storage
- purpose:
  - `user_preferences` は初回の cold start を補う explicit signal です
  - `Personal Decision Profile` は `user_decisions` から学習する implicit signal です
  - 両者は競合させず、ranking / hints / alerts / digest personalisation を補完する前提で分離します
- onboarding flow:
  - 初回ログイン後または preference 未設定時、`/decisions` と auth callback から `/onboarding` に誘導します
  - step は `interest_topics -> active_subscriptions -> decision_priority -> daily_available_time (+ optional budget_sensitivity)` の 4 段です
  - 完了後は `next` つきで元画面に戻し、デフォルトは `/decisions` に戻します
- stored fields:
  - `interest_topics`
  - `active_subscriptions`
  - `decision_priority`
  - `daily_available_time`
  - `budget_sensitivity` (optional)
- product connection:
  - `src/lib/userPreferences.ts` の `initializeUserPreferenceProfile` と `buildUserPreferenceSurfaceContext` を入口として使います
  - `Next Best Decision` は `preferenceProfile` を ranking context に渡せます
  - `Decision Library` は `resolveDecisionLibraryDefaultSort` と lightweight personalization score を使って初期一覧だけ軽く最適化します
  - `Personal Hints / Watchlist Alerts / Paywall Copy / Weekly Digest` は `buildUserPreferenceSurfaceContext` を共通 adapter として使う前提です
- details: [Onboarding Personalization](docs/onboarding-personalization.md)

## Product Analytics Foundation
- 保存先は Supabase の `analytics_events` テーブルです
- UI では `src/lib/analytics/track.ts` の `track(eventName, props)` だけを呼び、保存失敗でも画面本体は壊れません
- サーバー側の checkout / webhook などは `src/lib/analytics/server.ts` 経由で同じイベント定義に記録します
- 匿名利用は `anonymous_id`、ログイン済みは `user_id`、課金状態は `is_paid` で切り分けます
- 最低限の集計は `/admin/analytics` で確認できます

### Analytics Table
- `analytics_events`
  - `id`
  - `user_id`
  - `anonymous_id`
  - `event_name`
  - `page`
  - `source`
  - `is_paid`
  - `event_properties`
  - `created_at`

### Tracked Events
- Page / surface:
  - `page_view`
  - `decisions_view`
  - `library_view`
  - `episodes_view`
  - `history_view`
  - `weekly_digest_view`
  - `account_view`
  - `onboarding_view`
- Onboarding / preferences:
  - `onboarding_start`
  - `onboarding_step_complete`
  - `onboarding_complete`
  - `preference_update`
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
  - `decision_replay_from_history_click`
  - `decision_replay_view`
  - `decision_replay_insight_impression`
- Decision library:
  - `library_search`
  - `library_filter_change`
  - `library_sort_change`
  - `library_card_click`
  - `library_pref_personalized_impression`
- Recommendations / monetization / retention:
  - `next_best_decision_impression`
  - `next_best_decision_click`
  - `paywall_view`
  - `subscribe_cta_click`
  - `checkout_started`
  - `checkout_completed`
  - `billing_portal_open`
  - `weekly_digest_open`
  - `weekly_digest_item_click`

### Analysis Use
- conversion:
  - `paywall_view -> subscribe_cta_click -> checkout_started -> checkout_completed`
- engagement:
  - `page_view`
  - `judgment_card_click`
  - `decision_calculator_result_view`
  - `decision_save`
  - `decision_replay_view`
- retention:
  - `weekly_digest_open`
  - `weekly_digest_item_click`
  - `outcome_reminder_impression`
  - `outcome_quick_submit`
  - `outcome_update`
- free / paid 差分:
  - `analytics_events.is_paid`
  - `analytics_events.user_id`
  - `analytics_events.event_properties.page/source`

### Manual Validation
1. preference 未設定ユーザーでログインし、`/onboarding` に入ることと `onboarding_start` が増えることを確認
2. onboarding の各 step を進めて、`onboarding_step_complete` が step ごとに増えることを確認
3. 完了後に `user_preferences` が保存され、`onboarding_complete` と `preference_update` が増えることを確認
4. `/account` から preference を再確認し、更新後に `preference_update` が増えることを確認
5. `/decisions` を開き、`page_view` と `decisions_view` が増えることを確認
6. judgment card を開き、`judgment_card_impression` / `judgment_card_click` が増えることを確認
7. calculator を開いて再判定し、`decision_calculator_open` / `decision_calculator_submit` / `decision_calculator_result_view` を確認
8. Save 後、Outcome Reminder が出る decision で quick submit し、`outcome_reminder_impression` / `outcome_quick_submit` / `outcome_update` を確認
9. reminder から History / Replay に遷移し、`outcome_reminder_click` / `outcome_reminder_to_replay_click` / `decision_replay_view` を確認
10. paid で replay insight が表示される場合は `decision_replay_insight_impression` を確認
11. Judgment Card で Save / Watch / Remove を押し、`watchlist_add` / `watchlist_remove` を確認
12. `/decisions/library` を開き、`library_view` が増えること、free / paid で表示件数と detail の差が出ることを確認
13. `/decisions/library` で search / filter / sort を操作し、`library_search` / `library_filter_change` / `library_sort_change` を確認
14. preference 設定済みユーザーが `/decisions/library` 初回表示を開き、`library_pref_personalized_impression` と default sort / 並び順の差分を確認
15. library card から Episode / History / Replay を開き、`library_card_click` を確認
16. `/watchlist` を開いて filter / link 操作を行い、`watchlist_view` / `watchlist_filter_change` / `watchlist_card_click` を確認
17. free で paywall を見たあと subscribe を押し、`paywall_view` / `subscribe_cta_click` / `checkout_started` を確認
18. Stripe webhook 後に `checkout_completed` を確認

### SQL Spot Checks
```sql
select event_name, count(*) as events
from public.analytics_events
where created_at >= now() - interval '7 days'
group by 1
order by 2 desc;
```

```sql
select
  event_name,
  is_paid,
  count(*) as events
from public.analytics_events
where created_at >= now() - interval '30 days'
group by 1, 2
order by 1, 2;
```

```sql
select
  count(*) filter (where event_name = 'paywall_view') as paywall_views,
  count(*) filter (where event_name = 'subscribe_cta_click') as subscribe_clicks,
  count(*) filter (where event_name = 'checkout_started') as checkout_started,
  count(*) filter (where event_name = 'checkout_completed') as checkout_completed
from public.analytics_events
where created_at >= now() - interval '30 days';
```

### Membership Tables
- `profiles`
  - `user_id`
  - `email`
  - `stripe_customer_id`
- `subscriptions`
  - `user_id`
  - `plan_type`
  - `status`
  - `current_period_end`
  - `stripe_customer_id`
  - `stripe_subscription_id`
  - `checkout_session_id`
- `episode_judgment_cards`
  - `episode_id`
  - `lang`
  - `genre`
  - `topic_order`
  - `topic_title`
  - `frame_type`
  - `judgment_type`
  - `judgment_summary`
  - `action_text`
  - `deadline_at`
  - `threshold_json`
  - `watch_points_json`
  - `confidence_score`
- `user_decisions`
  - `user_id`
  - `judgment_card_id`
  - `episode_id`
  - `decision_type`
  - `outcome`
  - `created_at`
  - `updated_at`
- `user_preferences`
  - `user_id`
  - `interest_topics`
  - `active_subscriptions`
  - `decision_priority`
  - `daily_available_time`
  - `budget_sensitivity`
  - `created_at`
  - `updated_at`

### Free vs Paid Boundary
- 無料:
  - `/episodes` と `/decisions` の最新1週間
  - `/decisions/library` の最近のカードを最大12件 preview
  - `/decisions` の一般優先判断を 1 件 preview
  - `/weekly-decisions` の一部 preview
  - `/history/replay/[id]` の preview
  - 音声再生
  - `script_polished_preview` ベースの短い preview
  - judgment summary
- 有料:
  - `/decisions` の personal な Next Best Decision を最大 3 件
  - `/decisions/library` の全件検索 / filter / sort / pagination
  - action_text / deadline_at / watch_points / threshold の詳細
  - `/history/replay/[id]` の full replay / insight
  - DeepDive 完全版
  - 過去アーカイブ全体
  - `/account` で会員状態の確認
  - Personal Decision Profile の育成
  - judgment card 上の personal hint

## Decision Library
- path: `/decisions/library`
- role: Judgment Cards を「一度見るだけ」ではなく、あとで検索・再訪・比較できる library に変える面です
- value: `topic_title / judgment_summary` 検索、`genre / frame_type / judgment_type / urgency` filter、`newest / deadline_soon / judgment_priority` sort を提供します
- personalization:
  - `interest_topics` に合う genre を初期一覧で少し上位に寄せます
  - `decision_priority` に応じて default sort を切り替えます
  - `active_subscriptions` に関連する topic を軽くブーストします
- future: Replay / Saved Decisions / Alerts はこの library の検索面と urgency 分類を土台として使います
- details: [docs/decision-library.md](docs/decision-library.md)

## Saved Decisions / Watchlist
- path: `/watchlist`
- purpose: まだ採用していない judgment card を `saved / watching / archived` の中間状態で残し、未来の判断を管理する
- difference from history: `Decision History` は採用済み判断と outcome 学習、`Watchlist` は未採用判断の保留・再訪・監視を担当する
- filters / sort:
  - filter: `status / genre / frame_type / urgency`
  - sort: `newest / deadline_soon / saved_order`
- free / paid:
  - free は active item を最大5件まで、一覧も簡易表示
  - paid は件数無制限で deadline / urgency を使った再訪を開放
- future connection:
  - alerts の送信対象
  - decision workflow で「未決判断」を再提示する面
  - replay / history へ戻る導線
- details: [docs/watchlist.md](docs/watchlist.md)

## Decision Replay
- path: `/history/replay/[id]`
- purpose: 履歴保存で終わらせず、`当時の判断` と `実際の結果` を並べて学べるようにする
- why replay matters: history 一覧だけでは、当時の `judgment summary / action / deadline / watch points` まで再現しづらい
- product connection:
  - Replay で蓄積した差分は `Personal Decision Profile` の質を上げる
  - 将来的には recommendation / Next Best Decision の feature に流用できる
- free / paid:
  - free は preview と outcome 比較まで
  - paid は full replay と rules-based insight まで
- details: [docs/decision-replay.md](docs/decision-replay.md)

## Outcome Reminder
- path: `/decisions`, `/history`
- purpose: outcome 未入力の saved decision を先回りで見つけ、結果入力率を上げて personal learning loop を閉じる
- why it matters:
  - outcome が入らないと `Personal Decision Profile` の学習密度が上がらない
  - replay の比較軸が薄くなり、`Next Best Decision` に返す信号も弱くなる
- reminder rules:
  - `deadline_at` を過ぎた判断
  - 保存から一定日数が経過した判断
  - `outcome IS NULL`
  - `use_now` / `watch` を優先
- free / paid:
  - free は reminder 表示件数を制限
  - paid は全件 reminder と full replay / insight を活用
- future connection:
  - 同じ helper を email reminder / push / weekly unresolved decisions / replay recommendation に流用する

## Project Layout
- `app/`: Next.js App Router
- `supabase/`: Supabase CLI 管理ディレクトリ
- `supabase/functions/`: Edge Functions
- `supabase/migrations/`: DB migrations
- `.kiro/specs/db-schema/`: DB スキーマ仕様
- `.kiro/specs/jobs-orchestration/`: ジョブ実行仕様
- `.kiro/specs/stripe-webhook/`: Stripe webhook 仕様
- `docs/`: 補助ドキュメント
- `src/lib/analytics/`: event definitions, client tracking, server ingestion, reporting helpers

## Rules
- This repository is **staging only**.
- All background jobs must be **idempotent**.
- Every job execution must be logged to `job_runs`.

## DB Notes
- Migration は `supabase/migrations/` に SQL で追加する
- 公開判定は `episodes.status='published'` かつ `published_at IS NOT NULL`
- 判断カードは `episode_judgment_cards` を source of truth とし、`episodes.judgment_cards` は後方互換のため残っていても product UI では参照しない
- `daily-generate` は未読 `letters` のうち「`tips.letter_id` 付き」を最優先し、次に新着未読を最大2件まで採用
- 採用済み `letters` は `is_used=true` に更新される

## Jobs Orchestration
- Functions: `daily-generate`, `plan-topics`, `write-script-ja`, `expand-script-ja`, `polish-script-ja`, `tts-ja`, `adapt-script-en`, `polish-script-en`, `tts-en`, `publish`
- `daily-generate` は上記を spec 順で実行する orchestrator
- `publish` は `episodes.status='published'` と `published_at=now()` を必ず設定
- `plan-topics` は `editor-in-chief` ロールで `trend digest` を作成し、`main_topics(3) / quick_news(6) / letters / ending` を返す
- `trend digest` は HTML/URL を除去し、`cleanedTitle / whatHappened / whyItMatters / toneTag` を生成して planning に利用する
- `write-script-ja` は入力 trend/letters を sanitize（HTML/entity/URL/placeholder除去）し、`OP / HEADLINE / DEEPDIVE x3 / QUICK NEWS x6 / LETTERS / OUTRO / SOURCES` の固定構造で生成する
- `write-script-ja` は判断視点を個人の時間とお金に限定し、DeepDiveの⑤⑥⑦を `今日の判断（個人視点） / 判断期限（個人の行動期限） / 監視ポイント（個人が見るべき数値）` として生成する
- `write-script-ja` の DeepDive ⑤は毎回 Frame A/B/C/D を宣言し、数値計算または条件判定で結論を出す（テンプレ判断の反復は禁止）
- `write-script-ja` / `expand-script-ja` / `polish-script-ja` は DeepDive から `topic_title / frame_type / judgment_type / judgment_summary / action_text / deadline_at / threshold_json / watch_points_json` を抽出し、`episode_judgment_cards` に同期する
- judgment extraction 失敗は pipeline を落とさず、`job_runs.payload.judgment_card_extraction` に抽出件数・保存件数・エラーを残す
- `write-script-ja` は `予算配分 / 媒体配分 / 事業者視点 / 業界戦略 / 媒体再設計` を本文で禁止し、QuickNewsタグを `【今使う】/【今使わない】/【監視】` に固定する
- `write-script-ja` の QuickNews は判断タグに加えて、可能な項目で Frame A/B/C/D の判断根拠を付与する
- `write-script-ja` は本文から URL を除去し、URL は `SOURCES` セクションにのみ保持する（`SOURCES_FOR_UI` には `trend_item_id` を保持）
- `write-script-ja` は `SCRIPT_MIN_CHARS_JA` 以上（推奨 3500〜6000 chars）を満たすように DeepDive/QuickNews の情報密度を調整し、重複行と `補足N` 形式を禁止する
- `polish-script-ja` / `polish-script-en` は OpenAI で「rewrite + expand」を実行し、JSON schema 固定で受け取った結果を `script_polished` / `script_polished_preview` に保存する
- `polish-script-ja` は OP固定文言（「この番組はあなたの時間とお金を守る」「解説ではなく意思決定支援」）と個人最適化ルールを維持し、各判断文を「あなたはどうするか」で締める
- polish は DeepDive ごとに concrete reference（数値/固有名詞）を最低2件要求し、不足時は最大1回だけ再生成する
- polish prompt は section tone を分離する（OP: conversational, HEADLINE: fast-paced, DEEPDIVE: analytical, QUICK NEWS: energetic, LETTERS: empathetic, OUTRO: forward-looking）
- polish 分量ゲートは JA 最低 `4500` chars、EN 最低 `1800` words（未達時はフォールバック）
- polish は最大2回試行し（`SCRIPT_POLISH_MAX_ATTEMPTS`）、JSON parse失敗/API失敗/分量不足/具体性不足時はフォールバックまたは再試行し、`job_runs.payload` に `lang / attempt / before_chars / after_chars / parse_ok / fallback_used / skipped_reason / error_summary / score` を残して継続する
- polish 後に script quality を自動評価し、`episodes.script_score`（平均）と `episodes.script_score_detail`（depth/clarity/repetition/concreteness/broadcast_readiness）を保存する
- `score < 8` の場合は `job_runs.payload.warning=true` として記録する
- `daily-generate` は `expand-script-ja` 後に `polish-script-ja`、`adapt-script-en` 後に `polish-script-en` を実行し、`tts-ja` / `tts-en` は `script_polished` を優先して読み上げる（なければ `script`）。`SCRIPT_POLISH_ENABLED=false` で polish のみ無効化できる
- `SKIP_TTS=true`（default）では `tts-ja` / `adapt-script-en` / `tts-en` / `publish` をスキップし、台本品質のみを検証できる
- `adapt-script-en` は script 生成後に `normalizeForSpeech` を適用し、URL を script から除去する（元URLは `trend_items.url` に保持）
- `daily-generate` は trend category を hard:soft:entertainment = 4:4:3 目標で選定し、`entertainment_bonus` で娯楽カテゴリを加点する
- `daily-generate` の script gate は `SCRIPT_MIN_CHARS_JA` / `SCRIPT_TARGET_CHARS_JA` / `SCRIPT_MAX_CHARS_JA`（＋`TARGET_SCRIPT_ESTIMATED_CHARS_PER_MIN`）で調整可能。推奨は `3500 / 4600 / 6000`
- `daily-generate` は `GENERATE_INTERVAL_DAYS`（default: `2`）未満の間隔では `status=skipped` で終了する。`{"force":true}` 指定時は間隔判定をバイパスして実行する
- `daily-generate` request contract:
  - `episodeDate?: string` (`YYYY-MM-DD`, 未指定時は JST 今日)
  - `genre?: string` (未指定時は `general`)
  - `force?: boolean` (未指定時は `false`)
- `ALLOWED_GENRES` で `daily-generate` の許可 `genre` を制御する（default: `general,entertainment,tech`）
  - `genre` が未許可の場合は `400 validation_error` を返し、`allowedGenres` をレスポンスに含める
- `episodes.genre` を保持し、`/episodes?genre=<value>` で絞り込み可能
- `daily-generate` response（success / skipped / failed）には必ず `requestEcho: { episodeDate, genre, force }` を含める
- 互換性メモ: 旧実装では `episodeDate` 未指定時に UTC 日付を使っていたため、既存運用で日付固定が必要な場合は `episodeDate` を明示指定する

### Manual Run (curl)
1. `supabase start`
2. `npm run dev -- --hostname 0.0.0.0`（`/api/tts` が provider に応じて `public/audio/*` を生成。Edge Function から到達させるため 0.0.0.0 bind 必須）
3. `supabase functions serve --env-file .env.local --no-verify-jwt`
4. `curl -i -X POST http://127.0.0.1:54321/functions/v1/daily-generate -H \"Content-Type: application/json\" -d '{\"episodeDate\":\"2026-02-16\"}'`
5. `curl -i -X POST http://127.0.0.1:54321/functions/v1/daily-generate -H \"Content-Type: application/json\" -d '{\"episodeDate\":\"2026-02-17\"}'`（interval未満なら `skipped:true`）
6. `curl -i -X POST http://127.0.0.1:54321/functions/v1/daily-generate -H \"Content-Type: application/json\" -d '{\"episodeDate\":\"2026-02-17\",\"force\":true}'`（強制実行）
7. `curl -i -X POST http://127.0.0.1:54321/functions/v1/daily-generate -H \"Content-Type: application/json\" -d '{\"episodeDate\":\"2026-02-17\",\"genre\":\"general\",\"force\":true}'`（request contract 明示例）
8. `psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c "select id, lang, audio_url from public.episodes order by created_at desc limit 2;"`
9. `audio_url` が `/audio/<episodeId>.<lang>.<audioVersion>.<ext>` なら `/episodes` で再生可能。
10. ローカル検証専用として `--no-verify-jwt` を使用。staging では通常どおり Authorization を付けて実行する。

### Genre Interval Example
- run: `curl -i -X POST http://127.0.0.1:54321/functions/v1/daily-generate -H "Content-Type: application/json" -d '{"episodeDate":"2026-02-20","genre":"entertainment"}'`
- skip (same genre, interval未達): `curl -i -X POST http://127.0.0.1:54321/functions/v1/daily-generate -H "Content-Type: application/json" -d '{"episodeDate":"2026-02-21","genre":"entertainment"}'`

### Scheduler (staging)
- GitHub Actions: `.github/workflows/scheduled-daily-publish.yml`
- cron: `0 22 * * *`（UTC 22:00 = JST 翌日 07:00）
- `workflow_dispatch` で手動実行可能
- 必要な Secrets:
  - `SUPABASE_FUNCTIONS_BASE_URL`（例: `https://<project-ref>.supabase.co/functions/v1`）
  - `SUPABASE_SERVICE_ROLE_KEY`
- 実行時は `episodeDate` に JST 日付（`YYYY-MM-DD`）を渡して `daily-generate` を実行

### 失敗時の確認手順（最小）
1. GitHub Actions の `Scheduled Daily Publish` を開く
2. `Failure diagnostics` step の `http_status` と `response_body` を確認
3. Artifacts の `scheduled-daily-publish-logs-<run_id>` をダウンロードし、`daily-generate-response.json` を確認
4. `runId` が出ている場合は `/admin/job-runs` または `job_runs` テーブルで該当 run の `status/error` を追跡

### Idempotency / Re-run
- `job_runs` は insert-only。各実行は必ず新しい `job_runs` 行を作成
- 各ステップは no-op 条件を持つ（例: `tts-*` は同一 `audioVersion` の `audio_url` 既存ならスキップ）
- `LOCAL_TTS_ENABLED=1` のとき `tts-ja` / `tts-en` は no-op 判定を無効化して毎回再合成する
- 失敗時は `job_runs.status='failed'` と `job_runs.error` を残す
- `publish` は JST日付単位で既存公開を検出し、同日重複公開を no-op で防止する

## Stripe Webhook (MVP)
- Endpoint: `/api/stripe/webhook`
- Handled event: `payment_intent.succeeded`
- Idempotency key: `tips.provider_payment_id` (UNIQUE)
- `payment_intent.metadata.letter_id` があれば `tips.letter_id` に保存（UUIDのみ採用）

## Stripe Subscription Checkout (MVP)
- Endpoint: `POST /api/stripe/subscription-checkout`
- 認証済みユーザーのみ実行可能
- 環境変数:
  - `STRIPE_SECRET_KEY`
  - `STRIPE_WEBHOOK_SECRET`
  - `STRIPE_PRICE_PRO_MONTHLY`
  - `STRIPE_BILLING_PORTAL_CONFIGURATION_ID`（任意。Stripe Dashboard の default portal configuration を使う場合は省略可）
  - `APP_BASE_URL`
- Checkout 成功時の戻り先: `/account?subscription=success&session_id={CHECKOUT_SESSION_ID}`
- Checkout キャンセル時の戻り先: `/account?subscription=cancel`
- webhook では以下を処理:
  - `checkout.session.completed`
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
- `customer.subscription.*` を受けると `subscriptions` が upsert され、`/episodes` の paid 判定に反映されます

## Stripe Billing Portal
- Endpoint: `POST /api/stripe/billing-portal`
- 認証済みユーザーのみ実行可能
- `viewer.stripeCustomerId` を元に Stripe Billing Portal session を生成し、戻り先は `/account`
- cancel / payment method update / invoice history / plan management の可否は Stripe Dashboard 側の portal configuration に従います

### Local Subscription Test
1. Supabase Auth の Site URL / redirect URL に `http://127.0.0.1:3000/auth/callback` を追加
2. `npm run dev`
3. `/episodes` または `/account` から Magic Link でログイン
4. `stripe listen --forward-to localhost:3000/api/stripe/webhook`
5. `STRIPE_PRICE_PRO_MONTHLY` に test price id を設定し、`Subscribe` を実行
6. webhook 後に `/account` で `PAID` バッジ、プラン名、ステータス、次回更新日、支払い状態が更新されることを確認
7. paid 状態になったら `サブスクを管理` から Billing Portal が開くことを確認

## Letter Tip Checkout (MVP)
- Page: `/letters/[id]/tip`
- Endpoint: `POST /api/stripe/checkout`
- Body: `{ "letter_id": "<UUID>", "amount": 200|500|1000 }`
- Checkout Session 作成時に `metadata.letter_id` と `payment_intent_data.metadata.letter_id` を設定
- レスポンスで `url` を返し、クライアントを Stripe Checkout へリダイレクト

### Required Env
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `APP_BASE_URL` (optional; 未設定時は request origin を利用)

### Local Test (Stripe CLI)
1. `npm run dev`
2. `stripe listen --forward-to localhost:3000/api/stripe/webhook`
3. `stripe trigger payment_intent.succeeded`
4. 同一 PaymentIntent の再送で `tips` が増えないことを確認（UNIQUE衝突は no-op）

### Manual Link (metadataなしの場合)
1. `psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c "update public.tips set letter_id='<LETTER_UUID>' where provider_payment_id='<PAYMENT_INTENT_ID>' and letter_id is null;"`
2. `daily-generate` 実行時に該当お便りが tip 優先で読み上げ対象になることを確認

## Letters API (MVP)
- Endpoint: `POST /api/letters`
- Body: `{ "displayName": "...", "text": "..." }`
- Inserts into `letters(display_name, text, created_at)`

### Local Test (curl)
1. `npm run dev`
2. `curl -i -X POST http://127.0.0.1:3000/api/letters -H "Content-Type: application/json" -d '{"displayName":"local-user","text":"hello"}'`
3. `psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c "select display_name,text,created_at from public.letters order by created_at desc limit 5;"`

## Episodes UI (MVP)
- Page: `/episodes`
- Displays: `title`, `lang`, `published_at`, preview
- Reads published rows from Supabase (`episodes.status='published'` and `published_at is not null`)
- 無料ユーザーは最新1週間の episode を表示し、判断カードは summary のみ表示する
- `action_text / deadline_at / watch_points_json / threshold_json / DeepDive 完全版 / 過去アーカイブ` は有料会員向け
- 有料ユーザーは `episode_judgment_cards` の全件と `script_polished` / `script` を表示する
- `audio_url` が `/audio/...` の場合、`public/audio` のローカル音声を `<audio>` タグで再生

## Weekly Decision Digest
- Page: `/weekly-decisions`
- 対象: 直近7日間の `episode_judgment_cards`
- judgment_type ごとに `use_now / watch / skip` を集計
- `genre` と `frame_type` の breakdown を表示
- 無料ユーザーはカテゴリごとに一部 preview を表示

## Admin Analytics
- Page: `/admin/analytics`
- 直近30日間の `analytics_events` を読み込み、以下を簡易表示します
  - volume: total / anonymous / free / paid
  - funnel: `paywall_view`, `subscribe_cta_click`, `checkout_started`, `checkout_completed`
  - engagement: `page_view`, `judgment_card_click`, `decision_calculator_result_view`, `decision_save`, `decision_replay_view`, `decision_replay_insight_impression`, `weekly_digest_open`, `outcome_update`
  - page views / top events

## Analytics Plan
- 詳細設計と今後の拡張方針は [docs/analytics-plan.md](docs/analytics-plan.md) を参照

## Personal Decision Profile
- Page: `/history`
- source: `user_decisions` + `episode_judgment_cards`
- 表示する最小指標:
  - 総判断数
  - `use_now / watch / skip` 比率
  - `success / regret / neutral` 比率
  - `frame_type` ごとの outcome 傾向
  - よく使うジャンル / 後悔しやすいジャンル
  - rules-based insight（最大3件）
- しきい値:
  - 総履歴が `5` 件未満なら insight を抑制
  - `frame_type` / `genre` / `threshold` ごとの強い hint は `3` 件以上ある場合のみ出す
- paid value:
  - profile を履歴保存の終点ではなく、judgment card に戻る personalized hint として使う
  - Replay で見えた per-decision の学びを recommendation / next best decision の入力特徴として再利用できる
- 有料ユーザーは今週の全件と deadline 付き一覧を表示
- 集計ロジックは `src/lib/weeklyDecisionDigest.ts` に分離し、週次メールや通知に流用できる形にしている

## TTS Provider (OpenAI + local fallback)
- API route: `POST /api/tts`（Node runtime, `/api/tts-local` は互換エイリアス）
- `tts-ja` / `tts-en` は `/api/tts` を呼び、`episodes.audio_url` を `/audio/<episodeId>.<lang>.<audioVersion>.<ext>` に更新
- `TTS_PROVIDER=openai` の場合は OpenAI `/v1/audio/speech` を使用し、失敗時は macOS local TTS（`say` + `afconvert`）へフォールバック
- OpenAI TTS は 1リクエスト文字数制限を超える台本を文単位で分割し、複数チャンクを結合して1本の音声として保存（長尺時は `mp3` を使用）
- `preTtsNormalize` で日本語読み仮名辞書（`src/lib/tts/dictionary.json`）を適用し、句点/改行単位で文を短く分割してから合成
- `ENABLE_TTS_PREPROCESS=1` の場合、Edge Function 側で URL 置換・括弧除去・カタカナ置換・句読点調整・ポーズ挿入を行ってから `/api/tts` を呼ぶ
- local provider は `say` + `afconvert` で WAV を生成し `public/audio` に保存
- `/api/tts` は `LOCAL_TTS_API_KEY` 設定時に `x-local-tts-api-key` ヘッダ必須
- 主要 env（任意）:
  - `TTS_PROVIDER` (`local` or `openai`, default: `local`)
  - `OPENAI_API_KEY`（`TTS_PROVIDER=openai` で必須）
  - `OPENAI_TTS_MODEL`（default: `gpt-4o-mini-tts`）
  - `OPENAI_TTS_VOICE_JA`
  - `OPENAI_TTS_VOICE_EN`
  - `OPENAI_TTS_FORMAT`（`mp3|opus|aac|flac|wav|pcm`, default: `wav`）
  - `OPENAI_TTS_SPEED`（`0.25`〜`4.0`）
  - `OPENAI_TTS_TIMEOUT_MS`（default: `120000`）
  - `OPENAI_TTS_MAX_INPUT_CHARS`（default: `1500`、上限 `4000`）
  - `OPENAI_TTS_INSTRUCTIONS_JA` / `OPENAI_TTS_INSTRUCTIONS_EN`（`gpt-4o-mini-tts` 時のみ有効）
  - `TTS_API_URL` (default: `http://host.docker.internal:3000/api/tts`)
  - `TTS_API_PATH`（default: `/api/tts`）
  - `TTS_API_TIMEOUT_MS`（default: `180000`。Edge Function から `/api/tts` を待つ最大ミリ秒）
  - `TTS_LOCAL_API_URL`（後方互換）
  - `LOCAL_TTS_BASE_URL` / `LOCAL_TTS_PATH`（後方互換）
  - `LOCAL_TTS_API_KEY`（設定時は Edge Function から同キー送信が必須）
  - `LOCAL_TTS_ENABLED=1`（`tts-ja` / `tts-en` の no-op 判定を無効化して毎回再合成）
  - `LOCAL_TTS_VOICE_JA`
  - `LOCAL_TTS_EN_VOICE`（英語voiceの最優先設定）
  - `LOCAL_TTS_VOICE_EN`（後方互換。`LOCAL_TTS_EN_VOICE` 未設定時のみ使用）
  - `ENABLE_LOCAL_TTS=true`（`NODE_ENV=development` でも有効）
  - `ENABLE_TTS_PREPROCESS=1`（`tts-ja` / `tts-en` で TTS 前処理を有効化）
  - `SCRIPT_MIN_CHARS_JA`（default: `3500`）
  - `SCRIPT_TARGET_CHARS_JA`（default: `4600`）
  - `SCRIPT_MAX_CHARS_JA`（default: `6000`）
  - `EPISODE_DEEPDIVE_COUNT`（default: `3`）
  - `EPISODE_QUICKNEWS_COUNT`（default: `6`）
  - `EPISODE_TOTAL_TARGET_CHARS`（default: `4600`）
  - `ENABLE_SCRIPT_EDITOR=1`（`write-script-ja` で OpenAI 後編集を有効化）
  - `SCRIPT_EDITOR_MODEL`（default: `gpt-4o-mini`）
  - `OPENAI_SCRIPT_MODEL`（default: `gpt-4.1-mini`）
    - 未設定時の内部fallbackは `polish-script-ja / polish-script-en` ともに `gpt-4.1-mini`
  - `SCRIPT_POLISH_ENABLED`（default: `true`）
  - `SCRIPT_POLISH_TARGET`（default: `15-20min`）
  - `SCRIPT_POLISH_MAX_ATTEMPTS`（default: `2`、上限 `2`）
  - `SCRIPT_POLISH_TIMEOUT_MS`（default: `120000`）
  - `OPENAI_SCRIPT_POLISH_TIMEOUT_MS`（後方互換。`SCRIPT_POLISH_TIMEOUT_MS` 未設定時のみ参照）
  - `OPENAI_SCRIPT_POLISH_TEMPERATURE`（default: `0.2`）
  - `SCRIPT_POLISH_MODEL`（後方互換。`OPENAI_SCRIPT_MODEL` 未設定時のみ参照）
  - `SKIP_TTS=true`（default。`true` で `tts-ja` / `tts-en` と publish をスキップ）
  - `TARGET_SCRIPT_MIN_CHARS`（後方互換。`SCRIPT_MIN_CHARS_JA` 未設定時に参照。default: `3500`）
  - `TARGET_SCRIPT_ESTIMATED_CHARS_PER_MIN`（default: `300`）
  - `TARGET_SCRIPT_DURATION_SEC`（任意。未指定時は `SCRIPT_TARGET_CHARS_JA` と係数から算出）

## Ops Audit UI (Local)
- Page: `/admin/job-runs`
- Page: `/admin/trends`（`trend_items` の score 内訳可視化）
- `job_runs` を実行単位（`daily-generate` run）でグルーピング表示
- 失敗 run を強調表示し、各 step の `status / error / elapsed` を確認可能
- `Recent Episodes` と `Related Runs` で episode と run の紐付きを確認可能

### Retry daily-generate (Local-only)
- `/admin/job-runs` の `Retry daily-generate` ボタンで `daily-generate` を再実行
- server route: `POST /api/admin/retry-daily-generate`
- route は local 実行前提（`NODE_ENV=development` または `ENABLE_OPS_RETRY=true`）
- local 以外や環境変数不足では `Disabled` 応答を返す（dry-run/disabled）
- 実行結果として `success/failed` と `run_id` を UI に表示

## Local Acceptance Script
- `scripts/e2e-local.sh` が MVP Acceptance の主要チェックを自動判定します。
- 実行: `bash scripts/e2e-local.sh`
- 成功時: `[RESULT] PASS (...)`

### Local Verification (script gate)
1. `supabase db reset --local --yes`
2. `curl -sS -X POST http://127.0.0.1:54321/functions/v1/ingest_trends_rss -H "Content-Type: application/json" -d '{"mockFeeds":[{"sourceKey":"local-rss","name":"Local RSS","url":"https://local.invalid/rss","weight":1.3,"category":"tech","xml":"<rss><channel><item><title>Topic A</title><link>https://example.com/a</link><description>A summary</description></item></channel></rss>"}]}'`
3. `curl -sS -X POST http://127.0.0.1:54321/functions/v1/daily-generate -H "Content-Type: application/json" -d '{"episodeDate":"2026-02-19"}'` を実行し、`outputs.plan/writeJa/polishJa` が揃うことを確認（`SKIP_TTS=false` の場合は `ttsJa/adaptEn/polishEn/ttsEn/publish` も確認）
4. `psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -At -F $'\t' -c "select lang,status,coalesce(audio_url,'') from public.episodes where lang in ('ja','en') order by published_at desc nulls last, created_at desc limit 2;"` で `SKIP_TTS=true` では `audio_url` が空のまま、`SKIP_TTS=false` では `ja/en` とも `status=published` かつ `audio_url` 非空を確認

### Troubleshooting
- `daily-generate` が `step_failed:tts-ja` で止まる:
  - `SKIP_TTS=false` を設定している場合にのみ発生するため、台本確認だけなら `SKIP_TTS=true` を維持する
  - `npm run dev -- --hostname 0.0.0.0` を起動し、`/api/tts` を Edge Function から到達可能にする
  - `.env.local` で `TTS_API_URL` / `LOCAL_TTS_BASE_URL` がローカル開発 URL を指しているか確認する
- script quality で `script_quality_failed:*`:
  - `ENABLE_SCRIPT_EDITOR=1` を有効化して後編集を試す
  - `SCRIPT_MIN_CHARS_JA` / `SCRIPT_TARGET_CHARS_JA` を見直す
  - `node --experimental-strip-types scripts/scriptQualityCheck.mts --file <path>` で対象台本を単体検証する
- TTS の読みが不自然:
  - `ENABLE_TTS_PREPROCESS=1` を有効化する
  - `src/lib/tts/dictionary.json` に固有名詞の読みを追加する

## Trend Ingestion (RSS Upgraded)
- Function: `ingest_trends_rss`
- source 設定: `supabase/functions/_shared/trendsConfig.ts`
- `trend_sources` は `weight`, `category`, `theme` を持ち、entertainment/game/anime/youtube/movie/music 系を中心に 20 本以上追加済み
- `trend_items` は `normalized_url + normalized_title_hash` とタイトル類似クラスタで重複統合
- `published_at` がRSSで欠損時は HTML メタ (`article:published_time` など) を取得し、`TREND_REQUIRE_PUBLISHED_AT=true` の場合は `fetched_at` fallback 項目を除外
- `published_at_source` は `rss|meta|fetched`、`published_at_fallback` は fallback timestamp を保存
- score 式: `freshness + weighted_source + (cluster_size_bonus + diversity_bonus + entertainment_bonus + category_weight_bonus) - (clickbait_penalty + category_weight_penalty + hard_news_penalty)`
- `trend_items.score_freshness/score_source/score_bonus/score_penalty` に内訳を保存し `/admin/trends` で表示
- `trend_items` には source snapshot として `source_name` / `source_category` / `source_theme` を保持
- clickbait 判定語は `TREND_CLICKBAIT_KEYWORDS` で上書き可能
- hardキーワード (`TREND_HARD_KEYWORDS`) と過激ワード (`TREND_OVERHEATED_KEYWORDS`) は減点対象（完全除外ではなく抑制）
- RSS取得は `TREND_RSS_FETCH_TIMEOUT_MS` でタイムアウト制御
- 調整 knob:
  - `TREND_MAX_ITEMS_TOTAL`（default: `60`）
  - `TREND_MAX_ITEMS_PER_SOURCE`（default: `10`）
  - `TREND_REQUIRE_PUBLISHED_AT`（default: `true`）
  - `TREND_CATEGORY_WEIGHTS`（JSON; entertainment を優遇し hard-news を緩やかに減点）
- digest/filter knob:
  - `TREND_DENY_KEYWORDS`（CSV。unsafe/hard block topic を除外）
  - `TREND_ALLOW_CATEGORIES`（CSV。指定時のみ対象カテゴリを許可）
  - `TREND_MAX_HARD_NEWS`（default: `1`）
- selection knob:
  - `TREND_TARGET_TOTAL`（default: `10`）
  - `TREND_TARGET_DEEPDIVE`（default: `3`）
  - `TREND_TARGET_QUICKNEWS`（default: `6`）
  - `TREND_MAX_HARD_TOPICS`（default: `1`）
  - `TREND_MIN_ENTERTAINMENT`（default: `4`）
  - `TREND_SOURCE_DIVERSITY_WINDOW`（default: `3`）
  - `TREND_LOOKBACK_HOURS`（default: `36`）
- `plan-topics` は normalized hash / domain / category cap を使って重複除外と分散選定を行い、`trendSelectionSummary` を payload に保存
- 実行結果は `fetchedCount`, `insertedCount`, `dedupedCount`, `publishedAtFilledCount`, `publishedAtRequiredFilteredCount`, `droppedTotalCount`, `droppedPerSourceCount` を返す
- `daily-generate` の `job_runs.payload` には `digest_used_count` / `digest_filtered_count` / `digest_category_distribution` / `trend_selection_summary` が保存される

### Local Run (deterministic)
1. `supabase start`
2. `supabase db reset --local --yes`
3. `supabase functions serve --no-verify-jwt`
4. `curl -i -X POST http://127.0.0.1:54321/functions/v1/ingest_trends_rss -H "Content-Type: application/json" -d '{"mockFeeds":[{"sourceKey":"local-rss","name":"Local RSS","url":"https://local.invalid/rss","weight":1.3,"category":"tech","xml":"<rss><channel><item><title>Topic A</title><link>https://example.com/a</link><description>A summary</description></item><item><title>Topic A!!!</title><link>https://example.com/a?utm_source=test</link><description>Duplicate summary</description></item></channel></rss>"}]}'`
5. `curl -i -X POST http://127.0.0.1:54321/functions/v1/daily-generate -H "Content-Type: application/json" -d '{"episodeDate":"2026-02-18"}'`
6. `psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c "select title,score,cluster_size,published_at_source from public.trend_items order by score desc limit 5;"`
7. `psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -At -F $'\t' -c "select coalesce((payload->'trend_selection_summary'->>'selectedEntertainment')::int,0), coalesce((payload->'trend_selection_summary'->>'selectedHard')::int,0) from public.job_runs where job_type='daily-generate' order by created_at desc limit 1;"`
8. `trend_runs.payload` に `dedupedCount` / `publishedAtFilledCount` が入り、`daily-generate` の entertainment 件数が `TREND_MIN_ENTERTAINMENT` 以上、hard 件数が `TREND_MAX_HARD_TOPICS` 以下であることを確認
