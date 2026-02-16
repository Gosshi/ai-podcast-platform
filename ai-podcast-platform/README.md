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
