# External Services Inventory

更新日: 2026-03-21  
対象サービス: `判断のじかん by SignalMove`

## 目的

本書は、プロダクトが依存する外部サービスを一覧化し、用途、扱うデータ、主要な環境変数、運用上の確認ポイントをまとめるための内部資料です。  
Stripe 審査、障害切り分け、運用引き継ぎ、将来の代替検討の基礎資料として使います。

## Active Services

| サービス | 役割 | 主な用途 | 主な設定 |
| --- | --- | --- | --- |
| Cloudflare | ドメイン / DNS | `signal-move.com` の取得、DNS 管理 | Cloudflare DNS |
| Vercel | ホスティング / デプロイ | Next.js アプリ本番配信、環境変数管理 | Vercel Project Settings |
| Supabase | DB / Auth / Functions | PostgreSQL、RLS、Magic Link 認証、Edge Functions | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL` |
| Stripe | 決済 | Checkout、Billing Portal、Webhook、サブスクリプション管理 | `STRIPE_SECRET_KEY`, `STRIPE_PRICE_PRO_MONTHLY`, `STRIPE_WEBHOOK_SECRET` |
| Resend | メール配信 | 管理者 OTP、ログイン通知、設定変更通知 | `RESEND_API_KEY`, `EMAIL_FROM` |
| OpenAI | LLM / 一部 TTS | 台本生成、推敲、品質評価、AI相談、TTS フォールバック | `OPENAI_API_KEY`, `OPENAI_SCRIPT_MODEL`, `OPENAI_TTS_MODEL` |
| VOICEVOX | 日本語 TTS | 日本語音声合成のメイン経路 | `VOICEVOX_URL`, `VOICEVOX_SPEAKER_ID_JA` |
| GitHub Actions | CI / 定期実行 | CI、週次セキュリティスキャン、定期ジョブ | GitHub Actions secrets |

## Optional / Planned Integrations

| サービス | 状態 | 用途 |
| --- | --- | --- |
| X API (旧 Twitter API) | 設定待ち | エピソード公開後の自動投稿 |
| Apple Podcasts / Spotify | 申請待ち | Podcast RSS 配信先 |
| Affiliate partners | 差し替え待ち | アフィリエイト導線 |

## Service Details

### Cloudflare

- 役割: ドメインレジストラ / DNS 管理
- 現在の使い方: `signal-move.com` を Vercel に向ける
- 扱うデータ: DNS レコード、ドメイン設定
- 注意点: DNS 変更時は Vercel 側の Domain 設定とセットで確認する

### Vercel

- 役割: Web ホスティング、デプロイ、環境変数管理
- 現在の使い方: Next.js アプリの本番 / Preview 配信
- 扱うデータ: サーバーサイド env、ビルド成果物、関数ログ
- 注意点:
  - `APP_BASE_URL`, `NEXT_PUBLIC_SITE_URL` は本番ドメインに統一する
  - Stripe / Resend / Supabase の秘密情報は Vercel env で管理する

### Supabase

- 役割: PostgreSQL、認証、RLS、Edge Functions
- 現在の使い方:
  - `profiles`, `subscriptions`, `episodes` などのアプリ DB
  - Magic Link ログイン
  - 生成パイプライン用 Functions
- 扱うデータ: 会員情報、購読状態、エピソード、通知状態
- 注意点:
  - migration 追加時は `supabase db push` を本番 project に反映する
  - Stripe / 通知機能は migration 未反映だと動作不全になりやすい

### Stripe

- 役割: 課金 / 契約管理
- 現在の使い方:
  - Checkout Session 作成
  - Billing Portal
  - Webhook で購読状態を DB に反映
- 扱うデータ: 顧客 ID、subscription ID、checkout session ID、購読状態
- 注意点:
  - test / live の key と price ID は別管理
  - Webhook secret は endpoint ごとに異なる
  - Radar / card testing 設定は Dashboard 側で確認する

### Resend

- 役割: アプリメール配信
- 現在の使い方:
  - 管理者 OTP
  - ログイン通知
  - 設定変更通知
- 扱うデータ: 送信先メールアドレス、通知本文
- 注意点:
  - `EMAIL_FROM` は認証済みドメイン配下にする
  - 送達確認は Resend Dashboard で確認する

### OpenAI

- 役割: LLM / 一部 TTS
- 現在の使い方:
  - 台本生成
  - 台本推敲
  - 品質評価
  - AI相談
  - TTS フォールバック
- 扱うデータ: トレンド情報、台本、相談プロンプト
- 注意点:
  - モデル変更時はコストと品質の両面で再検証する
  - PII を含む入力を増やさない

### VOICEVOX

- 役割: 日本語 TTS の主経路
- 現在の使い方: 生成した日本語台本の読み上げ
- 扱うデータ: 日本語スクリプト本文
- 注意点:
  - 本番構成では API 到達性と生成失敗時のフォールバックを確認する

### GitHub Actions

- 役割: CI / 定期ジョブ / セキュリティスキャン
- 現在の使い方:
  - build チェック
  - Weekly Security Scan
  - 定期バッチのトリガ
- 扱うデータ: ビルドログ、artifact、cron 実行ログ
- 注意点:
  - secrets の更新漏れに注意
  - Security Scan の artifact は定期的に確認する

## Key Operational Checks

### 課金まわり

- Stripe live mode の price / webhook が本番に設定済み
- `/account` から Checkout が開く
- Webhook が 200 で通る

### 認証 / 通知まわり

- Supabase migration が本番反映済み
- `RESEND_API_KEY` と `EMAIL_FROM` が本番設定済み
- ログイン通知と設定変更通知が送達される

### 管理者アクセスまわり

- `ADMIN_EMAILS` が設定済み
- `ADMIN_BASIC_AUTH_*` または `ADMIN_IP_ALLOWLIST` が設定済み
- `/admin/*` の外側制限が有効

## Related Docs

- [ARCHITECTURE.md](/Users/gota/Documents/src/ai-podcast-platform/ARCHITECTURE.md)
- [docs/stripe-security-response-basis.md](/Users/gota/Documents/src/ai-podcast-platform/docs/stripe-security-response-basis.md)
- [docs/security-operations-runbook.md](/Users/gota/Documents/src/ai-podcast-platform/docs/security-operations-runbook.md)
