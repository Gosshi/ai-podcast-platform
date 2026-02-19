# Script Pipeline Quality Report

Date: 2026-02-19
Repository: /Users/gota/Documents/src/ai-podcast-platform

## 1) Baseline (Phase 0)
- `main` latest was up to date.
- `npm ci`: pass.
- `npm run build`: initially failed once in this environment due transient `registry.npmjs.org` DNS lookup during auto-install path; later runs pass consistently.
- Baseline `daily-generate` run (`runId=e40a3d09-47cd-4c17-bc9b-0325973745e3`) failed at `tts-ja` with local network reachability issue to `/api/tts`.
- Baseline script samples contained artifacts such as `数式`, malformed HTML fragments, and repeated filler lines.

## 2) Implemented Upgrades
- Script normalization layer:
  - Added `supabase/functions/_shared/scriptNormalize.ts`.
  - Integrated into `write-script-ja` and a second normalization pass in `daily-generate`.
  - Added payload metrics: `removed_html_count`, `removed_url_count`, `deduped_lines_count`.
- LLM post-editor:
  - Added `supabase/functions/_shared/scriptEditor.ts`.
  - Feature flags: `ENABLE_SCRIPT_EDITOR`, `SCRIPT_EDITOR_MODEL`.
  - Safe fallback to unedited script on API failure or invalid output.
- TTS preprocessing:
  - Added `supabase/functions/_shared/ttsPreprocess.ts`.
  - Integrated into `tts-ja` / `tts-en` behind `ENABLE_TTS_PREPROCESS`.
  - Extended local TTS bridge (`_shared/localTts.ts`) to pass preprocessed text.
- Quality gate:
  - Added `supabase/functions/_shared/scriptQualityCheck.ts`.
  - Enforced in `daily-generate` for banned tokens, duplicate ratio, and minimum length.
  - Added CLI utility: `scripts/scriptQualityCheck.mts`.

## 3) Tests and CI Changes
- Added unit tests:
  - `tests/script-normalize.test.mts`
  - `tests/script-quality-check.test.mts`
  - `tests/tts-preprocess.test.mts`
- `npm run test`: pass (11/11).
- `npm run build`: pass.
- CI updated:
  - `.github/workflows/ci.yml`: runs `npm run test` before build.
  - `.github/workflows/nightly-e2e.yml`: runs `npm run test` before build.
- Local e2e script updated to include script quality assertions per generated JA episode.

## 4) Focused Runtime Verification (Post-change)
- `write-script-ja` direct verification (date `2026-02-21`) succeeded:
  - `episodeId=e1083c49-796c-426a-86d5-2ece3f5613d0`
  - `scriptChars=3693`
  - `removed_html_count=0`
  - `removed_url_count=0`
  - `deduped_lines_count=86`
- Script quality CLI against generated script returned:
  - `ok=true`
  - `duplicateRatio=0`
  - `duplicateLineCount=0`

## 5) Final Two-run Orchestrator Verification (Phase 6 status)
Attempted sequence:
1. DB reset local
2. Run `daily-generate` for `2026-02-19`
3. Run `daily-generate` for `2026-02-20`

Observed in this environment:
- API gateway returned timeout response after ~150s for both calls:
  - `{ "message": "The upstream server is timing out" }`
- During timeout window, function logs showed processing reached `write-script-ja` and `tts-ja`.
- Because upstream timed out, end-to-end publish completion could not be deterministically confirmed in this run.

## 6) Remaining Risks / Follow-ups
- End-to-end publish confirmation remains blocked by local upstream timeout during long `daily-generate` execution (TTS stage).
- Recommended next verification in a stable CI/staging runner:
  1. Run two `daily-generate` executions with a higher end-to-end timeout budget.
  2. Confirm `job_runs.status='success'` through `publish`.
  3. Confirm JA/EN `episodes.status='published'` and playable `audio_url`.
  4. Confirm quality metrics are populated in `job_runs.payload.scriptMetrics` for both runs.
