# stripe-webhook spec init

目的: Stripe(テストモード)で単発投げ銭を受け、Webhookで署名検証＋冪等にtipsへ反映する。
WebhookはNext.js Route Handlerで実装する（app/api/stripe/webhook/route.ts）。
