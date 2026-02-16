# Tasks: Jobs Orchestration (MVP)

## T1: Create Edge Function skeletons
- Create folders and index.ts for:
  daily-generate, plan-topics, write-script-ja, adapt-script-en, tts-ja, tts-en, publish
- Each has:
  - parse JSON input
  - connect to Supabase (service role)
  - write job_runs (running->success/failed)
  - minimal behavior per design

## T2: Implement daily-generate orchestration
- daily-generate calls each step in order
- Handle errors: stop and mark failed run

## T3: README docs
- Document:
  - how to deploy functions
  - how to run daily-generate manually
  - how to set Scheduler (high-level steps)

## T4: Local/staging smoke test
- Provide a simple curl invocation for each step
- Verify:
  - episodes rows are created (ja then en)
  - audio_url is set (mock ok)
  - status transitions to published
  - job_runs records exist for each step
