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

## Jobs Orchestration (Manual Run)
1. Supabase ローカルを起動: `supabase start`
2. Edge Functions をローカルで起動: `supabase functions serve --env-file .env.local`
3. 日次オーケストレーションを実行:
   `supabase functions invoke daily_generate --no-verify-jwt --body '{"episodeDate":"2026-02-16"}'`
4. 個別ステップを実行（必要時）:
   - `supabase functions invoke step_prepare_episode --no-verify-jwt --body '{"episodeDate":"2026-02-16","idempotencyKey":"daily:2026-02-16"}'`
   - `supabase functions invoke step_generate_script --no-verify-jwt --body '{"episodeDate":"2026-02-16","idempotencyKey":"daily:2026-02-16"}'`
   - `supabase functions invoke step_generate_audio --no-verify-jwt --body '{"episodeDate":"2026-02-16","idempotencyKey":"daily:2026-02-16"}'`
   - `supabase functions invoke step_finalize_episode --no-verify-jwt --body '{"episodeDate":"2026-02-16","idempotencyKey":"daily:2026-02-16"}'`

## Scheduler (Staging)
1. `daily_generate` を Supabase Edge Functions に deploy
2. Supabase Dashboard の Schedules で HTTP ジョブを作成
3. URL は `.../functions/v1/daily_generate` を指定し、`POST` を選択
4. Header に `Authorization: Bearer <service_role_or_scheduler_token>` を設定
5. Body は `{"episodeDate":"YYYY-MM-DD"}` 形式で指定（または空で当日実行）
6. 失敗時は `job_runs` の `status='failed'` と `error` を確認する

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
