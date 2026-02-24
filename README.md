# ai-podcast-platform

Staging 用の AI Podcast Platform 初期スキャフォールドです。

## Stack
- Next.js (App Router)
- TypeScript
- ESLint
- Supabase CLI (local project scaffold)

## Setup
1. `.env.example` を参考に `.env.local` を作成
2. 依存関係をインストール: `npm ci`
3. 開発サーバー起動: `npm run dev -- --hostname 0.0.0.0`
4. Supabase ローカル起動: `supabase start`
5. Supabase ローカル設定を確認: `supabase status`
6. Migration 適用: `supabase db reset --local --yes`

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

## DB Notes
- Migration は `supabase/migrations/` に SQL で追加する
- 公開判定は `episodes.status='published'` かつ `published_at IS NOT NULL`
- `daily-generate` は未読 `letters` のうち「`tips.letter_id` 付き」を最優先し、次に新着未読を最大2件まで採用
- 採用済み `letters` は `is_used=true` に更新される

## Jobs Orchestration
- Functions: `daily-generate`, `plan-topics`, `write-script-ja`, `expand-script-ja`, `script-polish-ja`, `tts-ja`, `adapt-script-en`, `tts-en`, `publish`
- `daily-generate` は上記を spec 順で実行する orchestrator
- `publish` は `episodes.status='published'` と `published_at=now()` を必ず設定
- `plan-topics` は `editor-in-chief` ロールで `trend digest` を作成し、`main_topics(3) / quick_news(6) / letters / ending` を返す
- `trend digest` は HTML/URL を除去し、`cleanedTitle / whatHappened / whyItMatters / toneTag` を生成して planning に利用する
- `write-script-ja` は入力 trend/letters を sanitize（HTML/entity/URL/placeholder除去）し、`OP / HEADLINE / DEEPDIVE x3 / QUICK NEWS x6 / LETTERS / OUTRO / SOURCES` の固定構造で生成する
- `write-script-ja` は本文から URL を除去し、URL は `SOURCES` セクションにのみ保持する（`SOURCES_FOR_UI` には `trend_item_id` を保持）
- `write-script-ja` は `SCRIPT_MIN_CHARS_JA` 以上（推奨 3500〜6000 chars）を満たすように DeepDive/QuickNews の情報密度を調整し、重複行と `補足N` 形式を禁止する
- `script-polish-ja` は `write-script-ja` のJA台本を LLM で放送品質に再構成し、重複/placeholder/URL混入を抑制して `episodes.script` を更新する
- `daily-generate` は `write-script-ja` 後に `ENABLE_SCRIPT_POLISH=true` の場合のみ `script-polish-ja` を実行し、その後に `scriptNormalize` と `scriptQualityCheck` で `"<" / "http" / "&#" / "数式" / 重複率 / 文字数` を gate する（`SOURCES` 内 URL は許容）
- `SKIP_TTS=true`（default）では `tts-ja` / `adapt-script-en` / `tts-en` / `publish` をスキップし、台本品質のみを検証できる
- `adapt-script-en` は script 生成後に `normalizeForSpeech` を適用し、URL を script から除去する（元URLは `trend_items.url` に保持）
- `daily-generate` は trend category を hard:soft:entertainment = 4:4:3 目標で選定し、`entertainment_bonus` で娯楽カテゴリを加点する
- `daily-generate` の script gate は `SCRIPT_MIN_CHARS_JA` / `SCRIPT_TARGET_CHARS_JA` / `SCRIPT_MAX_CHARS_JA`（＋`TARGET_SCRIPT_ESTIMATED_CHARS_PER_MIN`）で調整可能。推奨は `3500 / 4600 / 6000`

### Manual Run (curl)
1. `supabase start`
2. `npm run dev -- --hostname 0.0.0.0`（`/api/tts` が provider に応じて `public/audio/*` を生成。Edge Function から到達させるため 0.0.0.0 bind 必須）
3. `supabase functions serve --env-file .env.local --no-verify-jwt`
4. `curl -i -X POST http://127.0.0.1:54321/functions/v1/daily-generate -H \"Content-Type: application/json\" -d '{\"episodeDate\":\"2026-02-16\"}'`
5. `psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c "select id, lang, audio_url from public.episodes order by created_at desc limit 2;"`
6. `audio_url` が `/audio/<episodeId>.<lang>.<audioVersion>.<ext>` なら `/episodes` で再生可能。
7. ローカル検証専用として `--no-verify-jwt` を使用。staging では通常どおり Authorization を付けて実行する。

### Scheduler (staging)
- GitHub Actions: `.github/workflows/scheduled-daily-publish.yml`
- cron: `0 22 * * *`（UTC 22:00 = JST 翌日 07:00）
- `workflow_dispatch` で手動実行可能
- 必要な Secrets:
  - `SUPABASE_FUNCTIONS_BASE_URL`（例: `https://<project-ref>.supabase.co/functions/v1`）
  - `SUPABASE_SERVICE_ROLE_KEY`
- 実行時は `episodeDate` に JST 日付（`YYYY-MM-DD`）を渡して `daily-generate` を実行

### 失敗時の確認手順（最小）
1. GitHub Actions の `Scheduled Daily Publish` を開く
2. `Failure diagnostics` step の `http_status` と `response_body` を確認
3. Artifacts の `scheduled-daily-publish-logs-<run_id>` をダウンロードし、`daily-generate-response.json` を確認
4. `runId` が出ている場合は `/admin/job-runs` または `job_runs` テーブルで該当 run の `status/error` を追跡

### Idempotency / Re-run
- `job_runs` は insert-only。各実行は必ず新しい `job_runs` 行を作成
- 各ステップは no-op 条件を持つ（例: `tts-*` は同一 `audioVersion` の `audio_url` 既存ならスキップ）
- `LOCAL_TTS_ENABLED=1` のとき `tts-ja` / `tts-en` は no-op 判定を無効化して毎回再合成する
- 失敗時は `job_runs.status='failed'` と `job_runs.error` を残す
- `publish` は JST日付単位で既存公開を検出し、同日重複公開を no-op で防止する

## Stripe Webhook (MVP)
- Endpoint: `/api/stripe/webhook`
- Handled event: `payment_intent.succeeded`
- Idempotency key: `tips.provider_payment_id` (UNIQUE)
- `payment_intent.metadata.letter_id` があれば `tips.letter_id` に保存（UUIDのみ採用）

## Letter Tip Checkout (MVP)
- Page: `/letters/[id]/tip`
- Endpoint: `POST /api/stripe/checkout`
- Body: `{ "letter_id": "<UUID>", "amount": 200|500|1000 }`
- Checkout Session 作成時に `metadata.letter_id` と `payment_intent_data.metadata.letter_id` を設定
- レスポンスで `url` を返し、クライアントを Stripe Checkout へリダイレクト

### Required Env
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `APP_BASE_URL` (optional; 未設定時は request origin を利用)

### Local Test (Stripe CLI)
1. `npm run dev`
2. `stripe listen --forward-to localhost:3000/api/stripe/webhook`
3. `stripe trigger payment_intent.succeeded`
4. 同一 PaymentIntent の再送で `tips` が増えないことを確認（UNIQUE衝突は no-op）

### Manual Link (metadataなしの場合)
1. `psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c "update public.tips set letter_id='<LETTER_UUID>' where provider_payment_id='<PAYMENT_INTENT_ID>' and letter_id is null;"`
2. `daily-generate` 実行時に該当お便りが tip 優先で読み上げ対象になることを確認

## Letters API (MVP)
- Endpoint: `POST /api/letters`
- Body: `{ "displayName": "...", "text": "..." }`
- Inserts into `letters(display_name, text, created_at)`

### Local Test (curl)
1. `npm run dev`
2. `curl -i -X POST http://127.0.0.1:3000/api/letters -H "Content-Type: application/json" -d '{"displayName":"local-user","text":"hello"}'`
3. `psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c "select display_name,text,created_at from public.letters order by created_at desc limit 5;"`

## Episodes UI (MVP)
- Page: `/episodes`
- Displays: `title`, `lang`, `published_at`
- Reads published rows from Supabase (`episodes.status='published'` and `published_at is not null`)
- `audio_url` が `/audio/...` の場合、`public/audio` のローカル音声を `<audio>` タグで再生

## TTS Provider (OpenAI + local fallback)
- API route: `POST /api/tts`（Node runtime, `/api/tts-local` は互換エイリアス）
- `tts-ja` / `tts-en` は `/api/tts` を呼び、`episodes.audio_url` を `/audio/<episodeId>.<lang>.<audioVersion>.<ext>` に更新
- `TTS_PROVIDER=openai` の場合は OpenAI `/v1/audio/speech` を使用し、失敗時は macOS local TTS（`say` + `afconvert`）へフォールバック
- OpenAI TTS は 1リクエスト文字数制限を超える台本を文単位で分割し、複数チャンクを結合して1本の音声として保存（長尺時は `mp3` を使用）
- `preTtsNormalize` で日本語読み仮名辞書（`src/lib/tts/dictionary.json`）を適用し、句点/改行単位で文を短く分割してから合成
- `ENABLE_TTS_PREPROCESS=1` の場合、Edge Function 側で URL 置換・括弧除去・カタカナ置換・句読点調整・ポーズ挿入を行ってから `/api/tts` を呼ぶ
- local provider は `say` + `afconvert` で WAV を生成し `public/audio` に保存
- `/api/tts` は `LOCAL_TTS_API_KEY` 設定時に `x-local-tts-api-key` ヘッダ必須
- 主要 env（任意）:
  - `TTS_PROVIDER` (`local` or `openai`, default: `local`)
  - `OPENAI_API_KEY`（`TTS_PROVIDER=openai` で必須）
  - `OPENAI_TTS_MODEL`（default: `gpt-4o-mini-tts`）
  - `OPENAI_TTS_VOICE_JA`
  - `OPENAI_TTS_VOICE_EN`
  - `OPENAI_TTS_FORMAT`（`mp3|opus|aac|flac|wav|pcm`, default: `wav`）
  - `OPENAI_TTS_SPEED`（`0.25`〜`4.0`）
  - `OPENAI_TTS_TIMEOUT_MS`（default: `120000`）
  - `OPENAI_TTS_MAX_INPUT_CHARS`（default: `1500`、上限 `4000`）
  - `OPENAI_TTS_INSTRUCTIONS_JA` / `OPENAI_TTS_INSTRUCTIONS_EN`（`gpt-4o-mini-tts` 時のみ有効）
  - `TTS_API_URL` (default: `http://host.docker.internal:3000/api/tts`)
  - `TTS_API_PATH`（default: `/api/tts`）
  - `TTS_API_TIMEOUT_MS`（default: `180000`。Edge Function から `/api/tts` を待つ最大ミリ秒）
  - `TTS_LOCAL_API_URL`（後方互換）
  - `LOCAL_TTS_BASE_URL` / `LOCAL_TTS_PATH`（後方互換）
  - `LOCAL_TTS_API_KEY`（設定時は Edge Function から同キー送信が必須）
  - `LOCAL_TTS_ENABLED=1`（`tts-ja` / `tts-en` の no-op 判定を無効化して毎回再合成）
  - `LOCAL_TTS_VOICE_JA`
  - `LOCAL_TTS_EN_VOICE`（英語voiceの最優先設定）
  - `LOCAL_TTS_VOICE_EN`（後方互換。`LOCAL_TTS_EN_VOICE` 未設定時のみ使用）
  - `ENABLE_LOCAL_TTS=true`（`NODE_ENV=development` でも有効）
  - `ENABLE_TTS_PREPROCESS=1`（`tts-ja` / `tts-en` で TTS 前処理を有効化）
  - `SCRIPT_MIN_CHARS_JA`（default: `3500`）
  - `SCRIPT_TARGET_CHARS_JA`（default: `4600`）
  - `SCRIPT_MAX_CHARS_JA`（default: `6000`）
  - `EPISODE_DEEPDIVE_COUNT`（default: `3`）
  - `EPISODE_QUICKNEWS_COUNT`（default: `6`）
  - `EPISODE_TOTAL_TARGET_CHARS`（default: `4600`）
  - `ENABLE_SCRIPT_EDITOR=1`（`write-script-ja` で OpenAI 後編集を有効化）
  - `SCRIPT_EDITOR_MODEL`（default: `gpt-4o-mini`）
  - `ENABLE_SCRIPT_POLISH=false`（default。`true` のときだけ `script-polish-ja` を有効化）
  - `SCRIPT_POLISH_MODEL`（default: `gpt-4o-mini`）
  - `SKIP_TTS=true`（default。`true` で `tts-ja` / `tts-en` と publish をスキップ）
  - `TARGET_SCRIPT_MIN_CHARS`（後方互換。`SCRIPT_MIN_CHARS_JA` 未設定時に参照。default: `3500`）
  - `TARGET_SCRIPT_ESTIMATED_CHARS_PER_MIN`（default: `300`）
  - `TARGET_SCRIPT_DURATION_SEC`（任意。未指定時は `SCRIPT_TARGET_CHARS_JA` と係数から算出）

## Ops Audit UI (Local)
- Page: `/admin/job-runs`
- Page: `/admin/trends`（`trend_items` の score 内訳可視化）
- `job_runs` を実行単位（`daily-generate` run）でグルーピング表示
- 失敗 run を強調表示し、各 step の `status / error / elapsed` を確認可能
- `Recent Episodes` と `Related Runs` で episode と run の紐付きを確認可能

### Retry daily-generate (Local-only)
- `/admin/job-runs` の `Retry daily-generate` ボタンで `daily-generate` を再実行
- server route: `POST /api/admin/retry-daily-generate`
- route は local 実行前提（`NODE_ENV=development` または `ENABLE_OPS_RETRY=true`）
- local 以外や環境変数不足では `Disabled` 応答を返す（dry-run/disabled）
- 実行結果として `success/failed` と `run_id` を UI に表示

## Local Acceptance Script
- `scripts/e2e-local.sh` が MVP Acceptance の主要チェックを自動判定します。
- 実行: `bash scripts/e2e-local.sh`
- 成功時: `[RESULT] PASS (...)`

### Local Verification (script gate)
1. `supabase db reset --local --yes`
2. `curl -sS -X POST http://127.0.0.1:54321/functions/v1/ingest_trends_rss -H "Content-Type: application/json" -d '{"mockFeeds":[{"sourceKey":"local-rss","name":"Local RSS","url":"https://local.invalid/rss","weight":1.3,"category":"tech","xml":"<rss><channel><item><title>Topic A</title><link>https://example.com/a</link><description>A summary</description></item></channel></rss>"}]}'`
3. `curl -sS -X POST http://127.0.0.1:54321/functions/v1/daily-generate -H "Content-Type: application/json" -d '{"episodeDate":"2026-02-19"}'` を実行し、`outputs.plan/writeJa/scriptPolish` が揃うことを確認（`SKIP_TTS=false` の場合は `ttsJa/adaptEn/ttsEn/publish` も確認）
4. `psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -At -F $'\t' -c "select lang,status,coalesce(audio_url,'') from public.episodes where lang in ('ja','en') order by published_at desc nulls last, created_at desc limit 2;"` で `SKIP_TTS=true` では `audio_url` が空のまま、`SKIP_TTS=false` では `ja/en` とも `status=published` かつ `audio_url` 非空を確認

### Troubleshooting
- `daily-generate` が `step_failed:tts-ja` で止まる:
  - `SKIP_TTS=false` を設定している場合にのみ発生するため、台本確認だけなら `SKIP_TTS=true` を維持する
  - `npm run dev -- --hostname 0.0.0.0` を起動し、`/api/tts` を Edge Function から到達可能にする
  - `.env.local` で `TTS_API_URL` / `LOCAL_TTS_BASE_URL` がローカル開発 URL を指しているか確認する
- script quality で `script_quality_failed:*`:
  - `ENABLE_SCRIPT_EDITOR=1` を有効化して後編集を試す
  - `SCRIPT_MIN_CHARS_JA` / `SCRIPT_TARGET_CHARS_JA` を見直す
  - `node --experimental-strip-types scripts/scriptQualityCheck.mts --file <path>` で対象台本を単体検証する
- TTS の読みが不自然:
  - `ENABLE_TTS_PREPROCESS=1` を有効化する
  - `src/lib/tts/dictionary.json` に固有名詞の読みを追加する

## Trend Ingestion (RSS Upgraded)
- Function: `ingest_trends_rss`
- source 設定: `supabase/functions/_shared/trendsConfig.ts`
- `trend_sources` は `weight`, `category`, `theme` を持ち、entertainment/game/anime/youtube/movie/music 系を中心に 20 本以上追加済み
- `trend_items` は `normalized_url + normalized_title_hash` とタイトル類似クラスタで重複統合
- `published_at` がRSSで欠損時は HTML メタ (`article:published_time` など) を取得し、`TREND_REQUIRE_PUBLISHED_AT=true` の場合は `fetched_at` fallback 項目を除外
- `published_at_source` は `rss|meta|fetched`、`published_at_fallback` は fallback timestamp を保存
- score 式: `freshness + weighted_source + (cluster_size_bonus + diversity_bonus + entertainment_bonus + category_weight_bonus) - (clickbait_penalty + category_weight_penalty + hard_news_penalty)`
- `trend_items.score_freshness/score_source/score_bonus/score_penalty` に内訳を保存し `/admin/trends` で表示
- `trend_items` には source snapshot として `source_name` / `source_category` / `source_theme` を保持
- clickbait 判定語は `TREND_CLICKBAIT_KEYWORDS` で上書き可能
- hardキーワード (`TREND_HARD_KEYWORDS`) と過激ワード (`TREND_OVERHEATED_KEYWORDS`) は減点対象（完全除外ではなく抑制）
- RSS取得は `TREND_RSS_FETCH_TIMEOUT_MS` でタイムアウト制御
- 調整 knob:
  - `TREND_MAX_ITEMS_TOTAL`（default: `60`）
  - `TREND_MAX_ITEMS_PER_SOURCE`（default: `10`）
  - `TREND_REQUIRE_PUBLISHED_AT`（default: `true`）
  - `TREND_CATEGORY_WEIGHTS`（JSON; entertainment を優遇し hard-news を緩やかに減点）
- digest/filter knob:
  - `TREND_DENY_KEYWORDS`（CSV。unsafe/hard block topic を除外）
  - `TREND_ALLOW_CATEGORIES`（CSV。指定時のみ対象カテゴリを許可）
  - `TREND_MAX_HARD_NEWS`（default: `1`）
- selection knob:
  - `TREND_TARGET_TOTAL`（default: `10`）
  - `TREND_TARGET_DEEPDIVE`（default: `3`）
  - `TREND_TARGET_QUICKNEWS`（default: `6`）
  - `TREND_MAX_HARD_TOPICS`（default: `1`）
  - `TREND_MIN_ENTERTAINMENT`（default: `4`）
  - `TREND_SOURCE_DIVERSITY_WINDOW`（default: `3`）
  - `TREND_LOOKBACK_HOURS`（default: `36`）
- `plan-topics` は normalized hash / domain / category cap を使って重複除外と分散選定を行い、`trendSelectionSummary` を payload に保存
- 実行結果は `fetchedCount`, `insertedCount`, `dedupedCount`, `publishedAtFilledCount`, `publishedAtRequiredFilteredCount`, `droppedTotalCount`, `droppedPerSourceCount` を返す
- `daily-generate` の `job_runs.payload` には `digest_used_count` / `digest_filtered_count` / `digest_category_distribution` / `trend_selection_summary` が保存される

### Local Run (deterministic)
1. `supabase start`
2. `supabase db reset --local --yes`
3. `supabase functions serve --no-verify-jwt`
4. `curl -i -X POST http://127.0.0.1:54321/functions/v1/ingest_trends_rss -H "Content-Type: application/json" -d '{"mockFeeds":[{"sourceKey":"local-rss","name":"Local RSS","url":"https://local.invalid/rss","weight":1.3,"category":"tech","xml":"<rss><channel><item><title>Topic A</title><link>https://example.com/a</link><description>A summary</description></item><item><title>Topic A!!!</title><link>https://example.com/a?utm_source=test</link><description>Duplicate summary</description></item></channel></rss>"}]}'`
5. `curl -i -X POST http://127.0.0.1:54321/functions/v1/daily-generate -H "Content-Type: application/json" -d '{"episodeDate":"2026-02-18"}'`
6. `psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c "select title,score,cluster_size,published_at_source from public.trend_items order by score desc limit 5;"`
7. `psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -At -F $'\t' -c "select coalesce((payload->'trend_selection_summary'->>'selectedEntertainment')::int,0), coalesce((payload->'trend_selection_summary'->>'selectedHard')::int,0) from public.job_runs where job_type='daily-generate' order by created_at desc limit 1;"`
8. `trend_runs.payload` に `dedupedCount` / `publishedAtFilledCount` が入り、`daily-generate` の entertainment 件数が `TREND_MIN_ENTERTAINMENT` 以上、hard 件数が `TREND_MAX_HARD_TOPICS` 以下であることを確認
