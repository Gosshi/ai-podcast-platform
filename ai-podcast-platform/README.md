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

## Stripe Webhook (Staging Test)
- 実装先: `app/api/stripe/webhook/route.ts`
- 対象イベント: `payment_intent.succeeded`
- 冪等キー: `tips.provider_payment_id`（Stripe PaymentIntent ID）

### Local Test with Stripe CLI
1. Stripe CLIでWebhook転送を開始
   - `stripe listen --forward-to localhost:3000/api/stripe/webhook`
2. 別ターミナルでNext.jsを起動
   - `npm run dev`
3. テストイベント送信
   - `stripe trigger payment_intent.succeeded`
4. 期待結果
   - 正常時は `tips` に1行追加される
   - 同一 PaymentIntent の再送時は `tips` は増えず、重複として no-op になる
   - 署名不正時は `400 invalid_signature` を返す
