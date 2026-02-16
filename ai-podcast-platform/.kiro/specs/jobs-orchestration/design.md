# Design: Jobs Orchestration (MVP)

## Edge Function structure
- supabase/functions/<function-name>/index.ts

Functions:
- daily-generate: orchestrator
- plan-topics
- write-script-ja
- adapt-script-en
- tts-ja
- tts-en
- publish

## Contracts (minimal)

### plan-topics
Input: none or {seed?}
Output: { topic: { title, bullets[] } }
MVP: ダミー（固定トピック）でOK

### write-script-ja
Input: { topic }
Output: { episode_id (ja), script, title?, description? }
Action:
- episodesにlang='ja'でinsert（status='generating'）
- script/title/descriptionをupdate

### adapt-script-en
Input: { master_episode_id }
Output: { episode_id (en), script }
Action:
- episodesにlang='en', master_id=ja.id でupsert
- script更新

### tts-ja / tts-en
Input: { episode_id }
Output: { audio_url, duration_sec }
MVP: audio_urlはダミー（例: "mock://audio/<id>.mp3"）
Action: episodes.audio_url/duration_secをupdate

### publish
Input: { episode_id_ja, episode_id_en }
Action:
- episodes.status='published'
- episodes.published_at = now()

## Orchestrator behavior
- daily-generate は順番に各関数を呼ぶ（HTTP fetch）
- 途中で失敗したら中断し、job_runsにfailedを残す

## job_runs logging
- 各関数は開始時に job_runs insert (status='running')
- 成功時に status='success', ended_at
- 失敗時に status='failed', error, ended_at
Payload例:
{
  "step": "write-script-ja",
  "episode_id": "...",
  "lang": "ja",
  "inputs": {...}
}

## Env Vars (placeholders)
- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY
- (optional) OPENAI_API_KEY
- (optional) TTS keys
