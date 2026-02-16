# Requirements: DB Schema (MVP)

## Goals
- MVPに必要なデータを保持し、日英エピソードの派生関係を表現できる
- 自律ジョブとWebhookの冪等性・監査を担保できる（job_runs / unique keys）
- 公開閲覧と管理操作の権限境界を最小限で切る（RLS）

## In Scope
- episodes / letters / tips / job_runs の4テーブル（必要ならenum相当のCHECK）
- 制約: CHECK, FK, UNIQUE, NOT NULL
- インデックス（最低限）
- RLS（最小）

## Out of Scope
- マルチテナント（creator_id 等）
- 詳細分析（再生ログ等）
- 音声お便り（STT）や複雑なチャプター編集

## Data Requirements

### episodes
- 1件のエピソードは1言語（lang）
- 日本語エピソード（lang='ja'）は master_id = NULL
- 英語エピソード（lang='en'）は master_id が必須で、参照先は日本語
- status: draft/queued/generating/ready/published/failed
- script（台本）を保持できる
- audio_url, duration_sec を保持できる
- published_at があれば公開対象になりうる

### letters
- display_name, text を保持
- moderation_status: pending/ok/needs_review/reject
- category: topic_request/question/feedback/other
- summary（LLM要約）を保持可能
- 任意で tip と紐付け可能（後からでも良い）

### tips
- Stripe webhook確定後に保存
- provider_payment_id を冪等キーとしてUNIQUE
- amount, currency を保持
- 任意で letter_id と紐付け

### job_runs
- job_type（plan/write_ja/adapt_en/tts_ja/tts_en/publish 等）
- payload（jsonb）
- status（running/success/failed など）
- error（text）
- started_at, ended_at

## Security / RLS (MVP)
- episodes: published の閲覧は匿名OK（またはpublished_atがあるもの）
- letters/tips/job_runs: 管理者のみ（認証必須）
- MVPでは「管理者=ログインユーザー」程度の最小でよい
