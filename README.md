# ai-podcast-platform

Staging 用の AI Podcast Platform 初期スキャフォールドです。

## Stack
- Next.js (App Router)
- TypeScript
- ESLint
- Supabase CLI (local project scaffold)

## Setup
1. `.env.example` を参考に `.env.local` を作成
2. 依存関係をインストール: `npm ci`
3. 開発サーバー起動: `npm run dev`
4. Supabase ローカル起動: `supabase start`
5. Supabase ローカル設定を確認: `supabase status`
6. Migration 適用: `supabase db reset --local --yes`

## Project Layout
- `app/`: Next.js App Router
- `supabase/`: Supabase CLI 管理ディレクトリ
- `supabase/functions/`: Edge Functions
- `supabase/migrations/`: DB migrations
- `.kiro/specs/db-schema/`: DB スキーマ仕様
- `.kiro/specs/jobs-orchestration/`: ジョブ実行仕様
- `.kiro/specs/stripe-webhook/`: Stripe webhook 仕様
- `docs/`: 補助ドキュメント

## Rules
- This repository is **staging only**.
- All background jobs must be **idempotent**.
- Every job execution must be logged to `job_runs`.

## DB Notes
- Migration は `supabase/migrations/` に SQL で追加する
- 公開判定は `episodes.status='published'` かつ `published_at IS NOT NULL`
- `daily-generate` は未読 `letters` のうち「`tips.letter_id` 付き」を最優先し、次に新着未読を最大2件まで採用
- 採用済み `letters` は `is_used=true` に更新される

## Jobs Orchestration
- Functions: `daily-generate`, `plan-topics`, `write-script-ja`, `tts-ja`, `adapt-script-en`, `tts-en`, `publish`
- `daily-generate` は上記を spec 順で実行する orchestrator
- `publish` は `episodes.status='published'` と `published_at=now()` を必ず設定

### Manual Run (curl)
1. `supabase start`
2. `supabase functions serve --no-verify-jwt`
3. `curl -i -X POST http://127.0.0.1:54321/functions/v1/daily-generate -H \"Content-Type: application/json\" -d '{\"episodeDate\":\"2026-02-16\"}'`
4. ローカル検証専用として `--no-verify-jwt` を使用。staging では通常どおり Authorization を付けて実行する。

### Scheduler (staging)
- Supabase Dashboard > Schedules で `daily-generate` を `POST` 実行
- body は `{\"episodeDate\":\"YYYY-MM-DD\"}` 形式（省略時は当日）

### Idempotency / Re-run
- `job_runs` は insert-only。各実行は必ず新しい `job_runs` 行を作成
- 各ステップは no-op 条件を持つ（例: `tts-*` は `audio_url` 既存ならスキップ）
- 失敗時は `job_runs.status='failed'` と `job_runs.error` を残す

## Stripe Webhook (MVP)
- Endpoint: `/api/stripe/webhook`
- Handled event: `payment_intent.succeeded`
- Idempotency key: `tips.provider_payment_id` (UNIQUE)
- `payment_intent.metadata.letter_id` があれば `tips.letter_id` に保存（UUIDのみ採用）

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
- Displays: `title`, `lang`, `published_at`
- Reads published rows from Supabase (`episodes.status='published'` and `published_at is not null`)

## Ops Audit UI (Local)
- Page: `/admin/job-runs`
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

## Trend Ingestion (RSS Foundation)
- Function: `ingest_trends_rss`
- DB tables: `trend_sources` (`weight`, `category`), `trend_items` (`hash` UNIQUE + `normalized_hash` UNIQUE), `trend_runs`
- score 式: `trend_items.score = trend_sources.weight × freshness_decay × signal`（現状 `signal=1`）
- `freshness_decay` は `published_at` の新しさで指数減衰（0-48hを評価）
- 重複記事は `trend_items.hash` / `trend_items.normalized_hash` の UNIQUE 衝突で no-op（insert-only）
- `daily-generate` は「直近24h」「カテゴリ/キーワード除外後」の `score` 上位3件を採用
- 除外設定は `TREND_EXCLUDED_CATEGORIES`, `TREND_EXCLUDED_KEYWORDS`（カンマ区切り env）で上書き可能

### Local Run (deterministic)
1. `supabase start`
2. `supabase db reset --local --yes`
3. `supabase functions serve --no-verify-jwt`
4. `curl -i -X POST http://127.0.0.1:54321/functions/v1/ingest_trends_rss -H "Content-Type: application/json" -d '{"mockFeeds":[{"sourceKey":"local-rss","name":"Local RSS","url":"https://local.invalid/rss","xml":"<rss><channel><item><title>Topic A</title><link>https://example.com/a</link><description>A summary</description><pubDate>Tue, 17 Feb 2026 12:00:00 GMT</pubDate></item></channel></rss>"}]}'`
5. `psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c "select count(*) from public.trend_items;"`
6. `trend_items` が 1 以上、`trend_runs` に実行ログが追加されることを確認
