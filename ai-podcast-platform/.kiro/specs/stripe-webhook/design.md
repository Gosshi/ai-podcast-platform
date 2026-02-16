# Design: Stripe Webhook (MVP)

## Endpoint
- Next.js Route Handler:
  - POST /api/stripe/webhook
  - file: app/api/stripe/webhook/route.ts

## Signature verification
- raw body を使って検証（Stripeの推奨）
- STRIPE_WEBHOOK_SECRET を使用

## Idempotency
- tips.provider_payment_id UNIQUE を利用し、重複イベントは no-op
- provider_payment_id は PaymentIntent ID を推奨
  - checkout.session.completed から payment_intent を取得できる場合がある

## Data mapping
- amount: 受領額（最小単位）をintegerで保存
- currency: 小文字通貨コード
- letter_id: metadata等で紐付ける場合のみ保存（MVPは任意）

## Logging
- Webhook処理の失敗は job_runs に残してもよいが、MVPは console/error + 500でも可
（後続で webhook_runs テーブルを追加する選択肢あり）
