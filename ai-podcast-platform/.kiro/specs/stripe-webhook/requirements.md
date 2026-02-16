# Requirements: Stripe Webhook (MVP)

## Goals
- 単発の投げ銭決済をStripeで開始できる（MVPはCheckout）
- Webhookで決済確定を受け、tipsに保存する
- 署名検証を必須とし、不正リクエストを拒否する
- 冪等に処理する（同イベント重複でも二重計上しない）

## In Scope
- Next.js Route Handler: app/api/stripe/webhook/route.ts
- Stripe署名検証（STRIPE_WEBHOOK_SECRET）
- tips insert（provider_payment_idのUNIQUEで重複no-op）
- READMEにStripe CLI等の検証手順を追記

## Out of Scope
- サブスク
- 返金処理
- 本番運用・税処理
- 複雑なUI（MVPはAPI側中心）

## Event Selection (MVP)
- まずは 1種類に絞る（例: checkout.session.completed または payment_intent.succeeded）
- どのIDを provider_payment_id にするか明記する（推奨: PaymentIntent ID）

## Security
- 署名検証に失敗したら 400 で拒否
- 秘密鍵はenvのみ（コミット禁止）
