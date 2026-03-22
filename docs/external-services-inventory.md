# External Services Inventory

更新日: 2026-03-22  
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
| X API (旧 Twitter API) | 実投稿実装済み / env 有効化待ち | エピソード公開後の自動投稿 |
| Apple Podcasts | 公開操作実施済み / listing 反映確認待ち | Podcast RSS 配信先 |
| Spotify for Creators | 公開済み | Podcast RSS 配信先 |
| Affiliate partners | env 差し替え対応済み / 本番 URL 投入待ち | アフィリエイト導線 |

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
  - Podcast 配信用音声は `OPENAI_TTS_FORMAT=mp3` を前提にする

### VOICEVOX

- 役割: 日本語 TTS の主経路
- 現在の使い方: 生成した日本語台本の読み上げ
- 扱うデータ: 日本語スクリプト本文
- 注意点:
  - 本番構成では API 到達性と生成失敗時のフォールバックを確認する
  - 現行の podcast 配信では `.wav` 経路のため RSS 掲載対象にしていない

### GitHub Actions

- 役割: CI / 定期ジョブ / セキュリティスキャン
- 現在の使い方:
  - build チェック
  - Weekly Security Scan
  - 定期バッチのトリガ
  - X 自動投稿 workflow の manual dispatch / post-publish 実行
- 扱うデータ: ビルドログ、artifact、cron 実行ログ
- 注意点:
  - secrets の更新漏れに注意
  - Security Scan の artifact は定期的に確認する
  - X 自動投稿は `X_AUTO_POST_ENABLED=true` と X credentials が揃っている時のみ実投稿される

### Apple Podcasts

- 役割: Podcast directory / 配信先
- 現在の使い方:
  - `https://signal-move.com/feed.xml` を登録して番組を配信する
- 状態:
  - `2026-03-22` 時点で公開操作実施済み
  - listing の最終反映確認は継続して確認する
- 注意点:
  - show cover は `1400px` 以上の正方形画像が必要
  - owner email は受信できるメールアドレスにする

### Spotify for Creators

- 役割: Podcast directory / 配信先
- 現在の使い方:
  - `https://signal-move.com/feed.xml` を登録して番組を配信する
- 状態:
  - `2026-03-22` 時点で公開済み
  - 公開 URL: `https://open.spotify.com/show/6nswsdY9ScaOvaLBkeKsFH`
- 注意点:
  - owner email 宛に verification code を送るため、受信できる RSS owner email が必要
  - title / cover の反映にはタイムラグがある

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

### ローンチ前の追加確認

- 特商法 / 利用規約 / プライバシーポリシーの公開ページを有効化する
- RSS feed に `item` が 1 件以上あることを確認する
- 公開音声のフォーマットが Apple Podcasts 提出条件を満たすことを確認する
- `https://signal-move.com/episodes/<id>` が `308` ではなく `200` で開くことを確認する
- show cover が `3000x3000` の `PNG` で配信されることを確認する
- アフィリエイト本番 URL を env に投入する
- X 自動投稿を使うなら GitHub workflow の manual dispatch を 1 回確認する

## Related Docs

- [ARCHITECTURE.md](/Users/gota/Documents/src/ai-podcast-platform/ARCHITECTURE.md)
- [docs/stripe-security-response-basis.md](/Users/gota/Documents/src/ai-podcast-platform/docs/stripe-security-response-basis.md)
- [docs/security-operations-runbook.md](/Users/gota/Documents/src/ai-podcast-platform/docs/security-operations-runbook.md)
- [docs/launch-readiness-runbook.md](/Users/gota/Documents/src/ai-podcast-platform/docs/launch-readiness-runbook.md)
