# Requirements: Jobs Orchestration (MVP)

## Goals
- 定期実行でエピソード生成を自律運転できる骨格を作る
- 各ステップは冪等で再実行できる
- 失敗時も job_runs と episodes.status で追跡できる

## Pipeline
- daily_generate (orchestrator)
  1) plan_topics
  2) write_script_ja
  3) tts_ja
  4) adapt_script_en
  5) tts_en
  6) publish

## In Scope (MVP)
- Supabase Edge Functions の雛形実装（各関数）
- job_runsへのログ記録（開始/成功/失敗）
- episodesのstatus更新（状態遷移）
- Scheduler設定手順のドキュメント化

## Out of Scope
- 実際のトレンド外部API連携（plan_topicsはダミー入力でも可）
- 実際のOpenAI/TTS呼び出し（モック可）
- リトライの自動化（手動再実行で十分）

## Idempotency Rules (MVP)
- episode生成対象が既にready/publishedならスキップ（または上書き禁止）
- 同一episode_idに対する各ステップは「未完了なら実行、完了済みならno-op」
- job_runsは毎実行で1レコード（もしくは再試行は別run）を残す

## Observability
- job_runs.errorにエラーメッセージを保存
- 主要payloadに episode_id, lang, step を含める
