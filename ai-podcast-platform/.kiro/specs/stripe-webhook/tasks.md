# Tasks: Stripe Webhook (MVP)

## T1: Add Stripe SDK and webhook route
- Install stripe package
- Create app/api/stripe/webhook/route.ts
- Implement raw body reading and signature verification

## T2: Handle selected event
- Choose event type (document in code and README)
- Extract:
  - provider_payment_id (PaymentIntent ID)
  - amount
  - currency
- Insert into tips with idempotency (handle unique conflict)

## T3: README update
- Add env vars:
  - STRIPE_SECRET_KEY
  - STRIPE_WEBHOOK_SECRET
- Add local test steps (Stripe CLI)
  - listen, trigger, and expected DB insert

## T4: Smoke test
- Provide manual test instructions and expected DB row
