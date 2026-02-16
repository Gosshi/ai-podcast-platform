# ai-podcast-platform

Staging 用の AI Podcast Platform 初期スキャフォールドです。

## Stack
- Next.js (App Router)
- TypeScript
- ESLint
- Supabase CLI (local project scaffold)

## Setup
1. `.env.example` を参考に `.env.local` を作成
2. 依存関係をインストール: `npm install`
3. 開発サーバー起動: `npm run dev`
4. Supabase ローカル設定を確認: `supabase status`

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

## Jobs Orchestration
- Functions: `daily-generate`, `plan-topics`, `write-script-ja`, `tts-ja`, `adapt-script-en`, `tts-en`, `publish`
- `daily-generate` は上記を spec 順で実行する orchestrator
- `publish` は `episodes.status='published'` と `published_at=now()` を必ず設定

### Manual Run (curl)
1. `supabase start`
2. `supabase functions serve --env-file .env.local`
3. `curl -i -X POST http://127.0.0.1:54321/functions/v1/daily-generate -H \"Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY\" -H \"Content-Type: application/json\" -d '{\"episodeDate\":\"2026-02-16\"}'`

### Scheduler (staging)
- Supabase Dashboard > Schedules で `daily-generate` を `POST` 実行
- body は `{\"episodeDate\":\"YYYY-MM-DD\"}` 形式（省略時は当日）

### Idempotency / Re-run
- `job_runs` は insert-only。各実行は必ず新しい `job_runs` 行を作成
- 各ステップは no-op 条件を持つ（例: `tts-*` は `audio_url` 既存ならスキップ）
- 失敗時は `job_runs.status='failed'` と `job_runs.error` を残す
