# ARCHITECTURE.md — 判断のじかん

## 概要

「判断のじかん」は、トレンドニュースから毎日 AI がポッドキャストを自動生成し、
リスナーに「やる・様子見・見送り」の判断を促す Next.js ベースのプラットフォーム。

---

## システム構成

```
┌─────────────────────────────────────────────────────────┐
│                    Next.js 16 (App Router)               │
│  ┌────────┐  ┌──────────┐  ┌────────┐  ┌────────────┐  │
│  │Pages   │  │ API Routes│  │ RSS/OGP│  │ Components │  │
│  └────┬───┘  └────┬─────┘  └────────┘  └────────────┘  │
│       │           │                                      │
│  ┌────┴───────────┴──────────────────────────┐          │
│  │        Supabase Client (RLS + Cookies)     │          │
│  └────────────────┬──────────────────────────┘          │
└───────────────────┼─────────────────────────────────────┘
                    │
    ┌───────────────┼───────────────────────┐
    │         Supabase (PostgreSQL)          │
    │  ┌──────────────────────────────────┐ │
    │  │ Tables: episodes, judgment_cards, │ │
    │  │ profiles, subscriptions, etc.     │ │
    │  └──────────────────────────────────┘ │
    │  ┌──────────────────────────────────┐ │
    │  │ Edge Functions (Deno)             │ │
    │  │ daily-generate, write-script,     │ │
    │  │ polish-script, tts, publish       │ │
    │  └──────────┬───────────────────────┘ │
    └─────────────┼─────────────────────────┘
                  │
    ┌─────────────┼──────────────────────┐
    │      External APIs                  │
    │  ┌─────────┐ ┌──────────┐ ┌─────┐ │
    │  │ OpenAI  │ │ VOICEVOX │ │Stripe│ │
    │  │ (GPT/TTS)│ │  (TTS)   │ │     │ │
    │  └─────────┘ └──────────┘ └─────┘ │
    └────────────────────────────────────┘
```

---

## LLM の使い所

### 1. エピソード台本生成（Supabase Edge Functions）

| ステップ | 関数 | モデル | 用途 |
|---------|------|--------|------|
| トピック選定 | `plan-topics` | - | トレンドスコアで機械的に選定 |
| 台本執筆 | `write-script-ja` | gpt-4.1-mini | ニュース要約 → ポッドキャスト台本 |
| 台本推敲 | `polish-script-ja` | gpt-4.1-mini | JSON Schema モードで構造化・推敲 |
| 品質評価 | `evaluateScriptQuality` | gpt-4.1-mini | 5 軸スコアリング（0-10） |
| 台本編集 | `scriptEditor` | gpt-4o-mini | 細かい文体修正 |
| 英語版適応 | `adapt-script-en` / `polish-script-en` | gpt-4.1-mini | 日→英の台本変換 |

**LLM に渡す情報**: トレンド記事の要約・タイトル・URL、過去エピソードの傾向
**LLM の出力**: セクション分割された台本 JSON（OP / HEADLINE / DEEPDIVE / QUICK NEWS / OUTRO）

### 2. 判断カード生成（ユーザー操作）

| 場所 | エンドポイント | モデル | 用途 |
|------|--------------|--------|------|
| AI相談 | `POST /api/generate-card` | gpt-4o-mini | ユーザーの悩みから判断カードを生成 |

**システムプロンプト**: 日本語のアドバイザーAI。ユーザープロフィール（予算感度・判断優先度・興味トピック・契約中サービス）をコンテキストとして注入。

**出力 JSON**:
```json
{
  "topic_title": "...",
  "genre": "テック",
  "judgment_type": "use_now | watch | skip",
  "judgment_summary": "...",
  "action_text": "...",
  "watch_points": ["..."],
  "confidence_score": 0.85
}
```

**レートリミット**: 無料 3 回/日、有料 20 回/日

### 3. 音声合成（TTS）

| プロバイダ | モデル | 用途 | 設定 |
|-----------|--------|------|------|
| VOICEVOX | Speaker ID 11 | 日本語の自然な読み上げ | `VOICEVOX_URL`, `VOICEVOX_SPEAKER_ID_JA` |
| OpenAI TTS | gpt-4o-mini-tts | 高品質な音声生成 | `OPENAI_TTS_MODEL`, `OPENAI_TTS_VOICE_JA` |
| Local (macOS say) | - | 開発用フォールバック | `ENABLE_LOCAL_TTS=true` |

**処理フロー**:
1. 台本テキストをチャンク分割（最大 1500 文字）
2. 日本語正規化（`preTtsNormalize.ts` で辞書ベース変換）
3. 各チャンクを TTS API で音声化
4. WAV PCM を連結して最終音声ファイルを生成

### 4. ヘッドライン処理（トレンド取り込み）

| 場所 | モデル | 用途 |
|------|--------|------|
| `headlineNormalizer.ts` | gpt-4.1-mini | ニュースヘッドラインから具体シグナルを抽出・圧縮 |

---

## データフロー

### エピソード生成パイプライン

```
RSS フィード
    │
    ▼
[ingest_trends_rss]  ← トレンドソース設定 (trend_sources テーブル)
    │  フィルタリング: クリックベイト除去、カテゴリ重み付け
    │  クラスタリング: 類似記事をグルーピング
    ▼
trend_items / trend_clusters テーブル
    │
    ▼
[daily-generate]  ← Cron or GitHub Action がトリガー
    │
    ├─→ [plan-topics]
    │      3 件 Deep Dive + 6 件 Quick News を選定
    │      ジャンル多様性・鮮度・スコアでランク付け
    │
    ├─→ [write-script-ja]  ← OpenAI GPT
    │      トレンド → 台本テキスト
    │      判断カード (episode_judgment_cards) を同時生成
    │
    ├─→ [polish-script-ja]  ← OpenAI GPT (JSON Schema)
    │      台本を推敲・構造化
    │      品質スコアリング (5 軸 × 0-10 点)
    │
    ├─→ [tts-ja]  ← VOICEVOX / OpenAI TTS
    │      台本 → 音声ファイル
    │
    └─→ [publish]
           episodes.status = 'published'
           published_at をセット
```

### ユーザー操作フロー

```
ユーザー
    │
    ├─→ ポッドキャスト再生 (/decisions)
    │      PostListenCTA → AudioPlayer
    │
    ├─→ トピックカード閲覧
    │      judgment_type で色分け表示
    │      (緑: 今すぐ / 青: 様子見 / 赤: 見送り)
    │
    ├─→ 判断を記録 (user_decisions テーブル)
    │      decision_type + 後日 outcome を記録
    │
    ├─→ AI 相談 (GenerateCardForm)
    │      POST /api/generate-card → OpenAI → user_generated_cards
    │
    └─→ ウォッチリスト / アラート管理
           気になるカードを保存・通知設定
```

### 課金フロー

```
ユーザー → 「有料版をはじめる」CTA
    │
    ▼
POST /api/stripe/subscription-checkout
    │  Stripe Checkout Session 作成
    ▼
Stripe 決済画面 (外部)
    │
    ▼
POST /api/stripe/webhook
    │  customer.subscription.created イベント処理
    │  subscriptions テーブル更新
    │  profiles テーブル更新
    ▼
ユーザーは有料機能を利用可能:
  - フルスクリプト閲覧
  - 行動提案・見直しタイミング
  - アーカイブ無制限
  - AI 相談 20 回/日
```

---

## データベース設計

### 主要テーブル

| テーブル | 用途 | 主なカラム |
|---------|------|-----------|
| `episodes` | エピソード本体 | id, lang, genre, title, script_polished, audio_url, status, published_at |
| `episode_judgment_cards` | エピソードの判断カード | episode_id, topic_title, judgment_type, judgment_summary, action_text, confidence_score |
| `profiles` | ユーザープロフィール | user_id, email, stripe_customer_id |
| `subscriptions` | サブスクリプション状態 | user_id, plan_type, status, stripe_subscription_id, current_period_end |
| `user_decisions` | ユーザーの判断記録 | user_id, judgment_card_id, decision_type, outcome |
| `user_generated_cards` | AI 相談で生成したカード | user_id, input_text, judgment_type, judgment_summary |
| `user_preferences` | ユーザー設定 | decision_priority, budget_sensitivity, interest_topics |
| `user_watchlist_items` | ウォッチリスト | user_id, judgment_card_id, status |
| `trend_items` | 取り込んだトレンド | title, url, summary, category, score |
| `trend_sources` | RSS ソース設定 | source_key, url, enabled, weight, category |
| `analytics_events` | 操作ログ | event_name, properties, user_id, timestamp |

### RLS (Row Level Security)

- 全テーブルで RLS 有効
- ユーザーは自分のデータのみ読み書き可能
- `episodes` は `status = 'published'` のみ一般公開
- Service Role キーは Supabase Edge Functions・Cron API で使用

---

## API エンドポイント一覧

### ユーザー向け

| Method | Path | 認証 | 用途 |
|--------|------|------|------|
| POST | `/api/generate-card` | 必須 | AI 相談カード生成 |
| GET/POST | `/api/user-preferences` | 必須 | ユーザー設定の取得・更新 |
| GET/POST | `/api/watchlist` | 必須 | ウォッチリスト管理 |
| PUT/DELETE | `/api/watchlist/[id]` | 必須 | ウォッチリスト個別操作 |
| POST | `/api/tts` | 必須 | 音声合成リクエスト |

### 課金

| Method | Path | 認証 | 用途 |
|--------|------|------|------|
| POST | `/api/stripe/subscription-checkout` | 必須 | Checkout セッション作成 |
| POST | `/api/stripe/billing-portal` | 必須 | 請求管理ポータル |
| POST | `/api/stripe/webhook` | Stripe署名 | Webhook 受信 |

### Cron / 管理

| Method | Path | 認証 | 用途 |
|--------|------|------|------|
| GET | `/api/cron/daily-generate` | CRON_SECRET | エピソード生成トリガー |
| GET | `/api/cron/generate-and-send-reminders` | CRON_SECRET | リマインダー送信 |
| GET | `/api/cron/send-weekly-digest` | CRON_SECRET | 週次ダイジェスト送信 |
| GET | `/api/social/twitter-post` | CRON_SECRET | Twitter 投稿用テキスト生成 |
| GET | `/api/email/send-alerts` | CRON_SECRET | アラートメール送信 |

### 公開

| Method | Path | 認証 | 用途 |
|--------|------|------|------|
| GET | `/feed.xml` | 不要 | Podcast RSS 2.0 フィード |
| GET | `/api/og` | 不要 | 動的 OGP 画像生成 |

---

## 技術スタック

| カテゴリ | 技術 |
|---------|------|
| フレームワーク | Next.js 16 (App Router) + React 19 |
| 言語 | TypeScript (strict mode) |
| DB / Auth | Supabase (PostgreSQL + RLS + Edge Functions) |
| LLM | OpenAI GPT-4.1-mini / GPT-4o-mini |
| TTS | VOICEVOX + OpenAI TTS + macOS say (dev) |
| 決済 | Stripe (Subscriptions + Checkout + Billing Portal) |
| メール | Resend |
| OGP | @vercel/og (Edge Runtime) |
| CI/CD | GitHub Actions |
| ホスティング | Vercel (想定) |

---

## 環境変数（主要）

```bash
# LLM
OPENAI_API_KEY=
OPENAI_SCRIPT_MODEL=gpt-4.1-mini        # 台本生成・推敲
OPENAI_TTS_MODEL=gpt-4o-mini-tts        # 音声合成

# TTS
TTS_PROVIDER=voicevox                     # voicevox | openai | local
VOICEVOX_URL=http://127.0.0.1:50021
VOICEVOX_SPEAKER_ID_JA=11

# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Stripe
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_PRO_MONTHLY=

# Cron
CRON_SECRET=                              # Cron エンドポイント認証

# Admin
ADMIN_EMAILS=your-email@example.com
ADMIN_ACCESS_SECRET=replace-with-long-random-secret
ADMIN_IP_ALLOWLIST=
ADMIN_BASIC_AUTH_USER=
ADMIN_BASIC_AUTH_PASSWORD=
RESEND_API_KEY=re_xxxx
EMAIL_FROM=SignalMove <noreply@signal-move.com>

# エピソード生成
GENERATE_INTERVAL_DAYS=2
SCRIPT_TARGET_CHARS_JA=4600
EPISODE_DEEPDIVE_COUNT=3
EPISODE_QUICKNEWS_COUNT=6
ALLOWED_GENRES=general,entertainment,tech
```

---

## ディレクトリ構造（主要）

```
app/
├── page.tsx                  # ランディングページ
├── decisions/
│   ├── page.tsx              # 今日のエピソード + トピックカード
│   └── [id]/page.tsx         # エピソード詳細
├── episodes/
│   ├── page.tsx              # アーカイブ一覧
│   └── EpisodesView.tsx      # クライアントビュー
├── guide/
│   └── page.tsx              # 使い方ガイド
├── api/
│   ├── generate-card/        # AI 相談
│   ├── cron/                 # 定期実行
│   ├── stripe/               # 課金
│   ├── social/               # SNS 投稿
│   ├── og/                   # OGP 画像
│   └── tts/                  # 音声合成
├── components/               # UI コンポーネント
└── lib/                      # サーバーサイドユーティリティ

src/lib/
├── tts/                      # TTS プロバイダ・正規化
├── analytics/                # イベント追跡
├── i18n/                     # 国際化
└── genre/                    # ジャンル設定

supabase/
├── functions/                # Edge Functions（エピソード生成パイプライン）
│   ├── daily-generate/
│   ├── write-script-ja/
│   ├── polish-script-ja/
│   ├── tts-ja/
│   ├── publish/
│   └── _shared/              # 共通ユーティリティ
└── migrations/               # DB マイグレーション
```
