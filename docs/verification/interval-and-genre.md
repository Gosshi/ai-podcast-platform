# Interval + Genre Verification Report

- Date: 2026-02-27 (local)
- Scope: `daily-generate` interval skip (`intervalDays=2`), `force=true`, genre allowlist, genre-separated lastEpisodeDate, and skip-time downstream suppression.
- Quality scope: script quality itself is out of scope.
- TTS policy during this verification: **disabled** (`DISABLE_TTS=true`).

## 0) Setup Evidence

### Git baseline (recorded before verification)

```bash
git status --short --branch
git log -5 --oneline
```

`git status --short --branch`:

```text
## main...origin/main
 M supabase/.gitignore
?? OpenAI
?? scripts/artifacts/
?? tmp/
```

`git log -5 --oneline`:

```text
0d4d52a feat: apply interval scheduling per genre (#71)
d5e1358 feat: add genre allowlist foundation (#70)
296ced4 feat: formalize daily-generate request contract (#69)
4df7f71 feat: add interval-based daily generate skipping (#68)
5fd57a2 feat: upgrade script quality with fact enrichment tone and scoring (#67)
```

### Build checks

```bash
npm ci
npm run build
```

Both passed in local environment.

### Local runtime

```bash
supabase start
supabase db reset --local --yes
supabase functions serve --env-file .env.local --no-verify-jwt
DISABLE_TTS=true npm run dev -- --hostname 127.0.0.1 --port 3000
```

### Verification env overrides

For this run, `.env.local` included:

```env
DISABLE_TTS=true
SKIP_TTS=false
EPISODE_TOTAL_TARGET_CHARS=1200
SCRIPT_MIN_CHARS_JA=500
SCRIPT_TARGET_CHARS_JA=900
SCRIPT_MAX_CHARS_JA=7000
TARGET_SCRIPT_DURATION_SEC=60
```

## 1) Safety: Force-disable TTS (required)

Implemented guards:

- `supabase/functions/tts-ja/index.ts`
- `supabase/functions/tts-en/index.ts`
- `src/lib/tts/apiRoute.ts` (`/api/tts` and `/api/tts-local` shared handler)

Behavior when `DISABLE_TTS=true`:

- Edge TTS functions return HTTP `503` with `errorType=tts_disabled`.
- Edge TTS functions write `job_runs.status='skipped'` with `reason='tts_disabled'`.
- Node API `/api/tts` returns HTTP `503` with `errorType=tts_disabled` before synth/IO.

Evidence:

```bash
curl -i -X POST http://127.0.0.1:54321/functions/v1/tts-ja -d '{...}'
curl -i -X POST http://127.0.0.1:54321/functions/v1/tts-en -d '{...}'
curl -i -X POST http://127.0.0.1:3000/api/tts -d '{}'
```

- `tmp/verification/tts-ja-disabled.txt`
- `tmp/verification/tts-en-disabled.txt`
- `tmp/verification/api-tts-disabled.txt`
- DB rows: `tmp/verification/db-tts-guard.txt`

## 2) Test Cases and Results

## Case A (P0): `intervalDays=2` skip判定 (forceなし)

Commands:

```bash
curl -sS -X POST http://127.0.0.1:54321/functions/v1/daily-generate \
  -H 'Content-Type: application/json' \
  -d '{"episodeDate":"2026-02-27"}' | jq

curl -sS -X POST http://127.0.0.1:54321/functions/v1/daily-generate \
  -H 'Content-Type: application/json' \
  -d '{"episodeDate":"2026-02-28"}' | jq
```

Responses:

- `2026-02-27`: `ok:false`, `runId=b5a305a0-d854-43e6-9c29-577c5bd96aa8`, error at `tts-ja` (`503`, disabled)
- `2026-02-28`: `ok:true`, `skipped:true`, `reason=interval_not_reached`, `intervalDays=2`, `lastEpisodeDate=2026-02-27`, `requestedEpisodeDate=2026-02-28`

Evidence files:

- `tmp/verification/caseA-1.json`
- `tmp/verification/caseA-2.json`

Result: **PASS**

## Case B (P1): `force=true` bypass interval

Command:

```bash
curl -sS -X POST http://127.0.0.1:54321/functions/v1/daily-generate \
  -H 'Content-Type: application/json' \
  -d '{"episodeDate":"2026-02-28","force":true}' | jq
```

Response:

- `ok:false`, `runId=cbc70bc3-c318-4c03-a711-55baa6fe938f`, error `step_failed:tts-ja:503:unknown`

DB evidence (force run window):

- `daily-generate` row has `decision=run`, `force=true`
- downstream steps ran (`plan-topics`, `write-script-ja`, `polish-script-ja`)
- `tts-ja` rows were blocked as `reason=tts_disabled`

Evidence files:

- `tmp/verification/caseB.json`
- `tmp/verification/db-force-window.txt`

Result: **PASS** (interval bypass succeeded; TTS was blocked by guard)

## Case C (P2): genre allowlist validation

Command:

```bash
curl -sS -i -X POST http://127.0.0.1:54321/functions/v1/daily-generate \
  -H 'Content-Type: application/json' \
  -d '{"episodeDate":"2026-02-28","genre":"unknownGenre"}'
```

Response:

- HTTP `400 Bad Request`
- body includes `allowedGenres: ["general","entertainment","tech"]`

Evidence file:

- `tmp/verification/caseC.txt`

Result: **PASS**

## Case D (P3): genre別に判定分離

Commands:

```bash
curl -sS -X POST http://127.0.0.1:54321/functions/v1/daily-generate \
  -H 'Content-Type: application/json' \
  -d '{"episodeDate":"2026-03-01","genre":"entertainment"}' | jq

curl -sS -X POST http://127.0.0.1:54321/functions/v1/daily-generate \
  -H 'Content-Type: application/json' \
  -d '{"episodeDate":"2026-03-01","genre":"tech"}' | jq
```

Observed:

- `entertainment`: `runId=40f784dd-50ba-4ce1-b5cc-abf509605446`, `skipped:true`, `lastEpisodeDate=2026-03-01`
- `tech`: `runId=aa92fe0c-1c2d-4d31-9872-5c3ed64f4904`, `decision=run` (not skipped), then failed in `write-script-ja` gate

Evidence files:

- `tmp/verification/caseD-ent-skip.json`
- `tmp/verification/caseD-tech-run.json`
- `tmp/verification/db-selected-runs.txt`

Result: **PASS** (same day, genre A skip / genre B run established)

## Case E (P4): skip時に後続ステップが一切呼ばれない

Dedicated isolated run:

- Precondition: inserted baseline episode (`genre=general`, `episode_date=2026-03-10`)
- Request: `episodeDate=2026-03-11`, `idempotencyKey=casee-logskip`

Command:

```bash
curl -sS -X POST http://127.0.0.1:54321/functions/v1/daily-generate \
  -H 'Content-Type: application/json' \
  -d '{"episodeDate":"2026-03-11","idempotencyKey":"casee-logskip"}' | jq
```

Response:

- `ok:true`, `skipped:true`, `reason=interval_not_reached`, `runId=f1df92c1-a1de-4213-87be-f687b0919107`

DB proof (`idempotencyKey=casee-logskip`):

- only one row exists: `job_type=daily-generate`, `status=skipped`
- downstream count (`plan/write/adapt/publish/tts`) = `0`

Function log snippet:

```text
2026-02-27T05:26:05.766295962Z serving the request with supabase/functions/daily-generate
(no tts-ja / tts-en invocation was emitted for this casee-logskip execution window)
```

Evidence files:

- `tmp/verification/caseE-logskip.json`
- `tmp/verification/db-casee-logskip.txt`
- `tmp/verification/db-casee-logskip-count.txt`
- `tmp/verification/functions-log-skip-snippet.txt`

Result: **PASS**

## 3) Run IDs (major)

- Case A run: `b5a305a0-d854-43e6-9c29-577c5bd96aa8`
- Case A skip: `f550e50c-f6fe-4282-855c-8b96b185b234`
- Case B force: `cbc70bc3-c318-4c03-a711-55baa6fe938f`
- Case D entertainment skip: `40f784dd-50ba-4ce1-b5cc-abf509605446`
- Case D tech run: `aa92fe0c-1c2d-4d31-9872-5c3ed64f4904`
- Case E skip (isolated): `f1df92c1-a1de-4213-87be-f687b0919107`

## 4) Verdict

- P0: PASS
- P1: PASS
- P2: PASS
- P3: PASS
- P4: PASS

## 5) Remaining Notes

- Several non-skip runs failed before full publish due script gate (`target_chars_not_met` etc.). This is outside the interval/genre/TTS suppression objective.
- For strict reproducibility, test-only gate overrides were applied in `.env.local` during this verification.
