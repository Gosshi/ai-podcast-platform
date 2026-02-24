#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"
export NPM_CONFIG_CACHE="$ROOT_DIR/.npm-cache"

TMP_DIR="$(mktemp -d /tmp/mvp-e2e.XXXXXX)"
FUNCTIONS_LOG_FILE="$TMP_DIR/functions.log"
NEXT_LOG_FILE="$TMP_DIR/next.log"
FUNCTIONS_PID=""
NEXT_PID=""
PASS_COUNT=0

cleanup() {
  if [ -n "$FUNCTIONS_PID" ] && kill -0 "$FUNCTIONS_PID" >/dev/null 2>&1; then
    kill "$FUNCTIONS_PID" >/dev/null 2>&1 || true
    wait "$FUNCTIONS_PID" >/dev/null 2>&1 || true
  fi
  if [ -n "$NEXT_PID" ] && kill -0 "$NEXT_PID" >/dev/null 2>&1; then
    kill "$NEXT_PID" >/dev/null 2>&1 || true
    wait "$NEXT_PID" >/dev/null 2>&1 || true
  fi
  rm -rf "$TMP_DIR"
}

trap cleanup EXIT

log() {
  printf "[e2e] %s\n" "$*"
}

pass() {
  PASS_COUNT=$((PASS_COUNT + 1))
  printf "[PASS] %s\n" "$*"
}

fail() {
  printf "[FAIL] %s\n" "$*" >&2
  exit 1
}

assert_command() {
  local label="$1"
  shift
  log "$label"
  if "$@"; then
    pass "$label"
  else
    fail "$label"
  fi
}

get_env_value() {
  local key="$1"
  local value
  value="$(printf "%s\n" "$STATUS_ENV" | sed -n "s/^${key}=\"\\(.*\\)\"$/\\1/p")"
  if [ -z "$value" ]; then
    fail "missing ${key} from supabase status -o env"
  fi
  printf "%s" "$value"
}

get_optional_env_value() {
  local key="$1"
  printf "%s\n" "$STATUS_ENV" | sed -n "s/^${key}=\"\\(.*\\)\"$/\\1/p"
}

date_add_days() {
  local base_date="$1"
  local days="$2"
  node -e "const [base,days]=process.argv.slice(1); const d=new Date(base + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + Number(days)); process.stdout.write(d.toISOString().slice(0,10));" "$base_date" "$days"
}

wait_for_functions() {
  local max_retry=60
  local i
  for ((i = 1; i <= max_retry; i++)); do
    local body
    body="$(curl -sS -X POST "$FUNCTIONS_URL/plan-topics" -H "Content-Type: application/json" -d '{}' || true)"
    if printf "%s" "$body" | grep -Fq "\"ok\":true"; then
      return 0
    fi
    sleep 1
  done
  return 1
}

wait_for_next() {
  local max_retry=90
  local i
  for ((i = 1; i <= max_retry; i++)); do
    local code
    code="$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:3000/episodes" || true)"
    if [ "$code" = "200" ]; then
      return 0
    fi
    sleep 1
  done
  return 1
}

run_daily_generate_with_retry() {
  local episode_date="$1"
  local max_retry=5
  local i
  local body=""
  for ((i = 1; i <= max_retry; i++)); do
    body="$(curl -sS -X POST "$FUNCTIONS_URL/daily-generate" -H "Content-Type: application/json" -d "{\"episodeDate\":\"$episode_date\"}" || true)"
    if grep -Fq "\"ok\":true" <<<"$body"; then
      printf "%s" "$body"
      return 0
    fi
    sleep 2
  done
  printf "%s" "$body"
  return 1
}

psql_query() {
  local sql="$1"
  psql "$DB_URL" -v ON_ERROR_STOP=1 -At -c "$sql"
}

assert_count_ge() {
  local label="$1"
  local actual="$2"
  local minimum="$3"
  if [ "$actual" -ge "$minimum" ]; then
    pass "${label} (actual=${actual}, expected>=${minimum})"
  else
    fail "${label} (actual=${actual}, expected>=${minimum})"
  fi
}

assert_count_eq() {
  local label="$1"
  local actual="$2"
  local expected="$3"
  if [ "$actual" -eq "$expected" ]; then
    pass "${label} (actual=${actual}, expected=${expected})"
  else
    fail "${label} (actual=${actual}, expected=${expected})"
  fi
}

assert_contains() {
  local label="$1"
  local haystack="$2"
  local needle="$3"
  if grep -Fq -- "$needle" <<<"$haystack"; then
    pass "$label"
  else
    fail "$label"
  fi
}

assert_contains_any() {
  local label="$1"
  local haystack="$2"
  local needle_a="$3"
  local needle_b="$4"
  if grep -Fq -- "$needle_a" <<<"$haystack" || grep -Fq -- "$needle_b" <<<"$haystack"; then
    pass "$label"
  else
    fail "$label"
  fi
}

assert_not_contains() {
  local label="$1"
  local haystack="$2"
  local needle="$3"
  if grep -Fq -- "$needle" <<<"$haystack"; then
    fail "$label"
  else
    pass "$label"
  fi
}

assert_script_quality() {
  local label="$1"
  local script="$2"
  if printf "%s" "$script" | node --experimental-strip-types scripts/scriptQualityCheck.mts >/dev/null; then
    pass "$label"
  else
    fail "$label"
  fi
}

extract_json_string_field() {
  local json="$1"
  local key="$2"
  printf "%s" "$json" | sed -n "s/.*\"${key}\":\"\\([^\"]*\\)\".*/\\1/p" | head -n 1
}

print_daily_failure_diagnostics() {
  local label="$1"
  local body="$2"
  local run_id
  run_id="$(extract_json_string_field "$body" "runId")"
  if [ -z "$run_id" ]; then
    run_id="(missing)"
  fi
  printf "[e2e][diag] %s runId=%s\n" "$label" "$run_id" >&2
  printf "[e2e][diag] %s response=%s\n" "$label" "$body" >&2
}

assert_command "npm ci" npm ci --cache "$NPM_CONFIG_CACHE"
assert_command "npm run build" npm run build

log "supabase start"
if supabase start >"$TMP_DIR/supabase-start.log" 2>&1; then
  pass "supabase start"
else
  tail -n 100 "$TMP_DIR/supabase-start.log" >&2 || true
  fail "supabase start"
fi

assert_command "supabase db reset --local --yes" supabase db reset --local --yes

log "collect local supabase env"
STATUS_ENV="$(supabase status -o env)"
API_URL="$(get_env_value API_URL)"
DB_URL="$(get_env_value DB_URL)"
ANON_KEY="$(get_env_value ANON_KEY)"
SERVICE_ROLE_KEY="$(get_env_value SERVICE_ROLE_KEY)"
FUNCTIONS_URL="$(get_optional_env_value FUNCTIONS_URL)"
if [ -z "$FUNCTIONS_URL" ]; then
  FUNCTIONS_URL="${API_URL}/functions/v1"
fi
pass "collect local supabase env"

log "start supabase functions serve"
supabase functions serve --no-verify-jwt >"$FUNCTIONS_LOG_FILE" 2>&1 &
FUNCTIONS_PID=$!
if wait_for_functions; then
  pass "supabase functions serve"
else
  tail -n 100 "$FUNCTIONS_LOG_FILE" >&2 || true
  fail "supabase functions serve"
fi

log "ingest trends with deterministic mock feeds"
INGEST_RESPONSE="$(curl -sS -X POST "$FUNCTIONS_URL/ingest_trends_rss" -H "Content-Type: application/json" -d '{"limitPerSource":5,"mockFeeds":[{"sourceKey":"mock-tech-a","name":"Mock Tech A","url":"https://mock.local/a","weight":1.4,"category":"tech","theme":"test","xml":"<rss><channel><item><title>AI Startup Raises Funding</title><link>https://example.com/ai-startup?utm_source=test</link><description>Funding round summary</description></item><item><title>Edge Devices Get Smaller</title><link>https://example.com/edge-devices</link><description>Chip packaging update</description><pubDate>Tue, 17 Feb 2026 12:00:00 GMT</pubDate></item></channel></rss>"},{"sourceKey":"mock-tech-b","name":"Mock Tech B","url":"https://mock.local/b","weight":1.2,"category":"tech","theme":"test","xml":"<rss><channel><item><title>AI Startup Raises Funding!!!</title><link>https://example.com/ai-startup?utm_medium=test</link><description>Duplicate angle from another source</description></item></channel></rss>"}]}')"
assert_contains "ingest_trends_rss returns ok" "$INGEST_RESPONSE" "\"ok\":true"
assert_contains "ingest_trends_rss exposes fetchedCount" "$INGEST_RESPONSE" "\"fetchedCount\":"
assert_contains "ingest_trends_rss exposes insertedCount" "$INGEST_RESPONSE" "\"insertedCount\":"
assert_contains "ingest_trends_rss exposes dedupedCount" "$INGEST_RESPONSE" "\"dedupedCount\":"
assert_contains "ingest_trends_rss exposes publishedAtFilledCount" "$INGEST_RESPONSE" "\"publishedAtFilledCount\":"

TREND_TOTAL_COUNT="$(psql_query "select count(*) from public.trend_items;")"
TREND_REPRESENTATIVE_COUNT="$(psql_query "select count(*) from public.trend_items where is_cluster_representative=true;")"
TREND_CLUSTERED_COUNT="$(psql_query "select count(*) from public.trend_items where cluster_size > 1;")"
TREND_PUBLISHED_SOURCE_COUNT="$(psql_query "select count(*) from public.trend_items where published_at is not null and published_at_source in ('rss','meta','fetched');")"
TREND_PUBLISHED_FILLED_COUNT="$(psql_query "select count(*) from public.trend_items where published_at_source in ('meta','fetched');")"

assert_count_ge "trend_items inserted from ingest" "$TREND_TOTAL_COUNT" 2
assert_count_ge "trend_items representative rows" "$TREND_REPRESENTATIVE_COUNT" 2
assert_count_ge "trend_items cluster_size reflects dedupe" "$TREND_CLUSTERED_COUNT" 1
assert_count_ge "trend_items published_at_source set" "$TREND_PUBLISHED_SOURCE_COUNT" 2
assert_count_ge "trend_items published_at filled via fallback" "$TREND_PUBLISHED_FILLED_COUNT" 1

log "start next dev server"
SELECTED_TTS_PROVIDER="${TTS_PROVIDER:-local}"
SUPABASE_URL="$API_URL" \
SUPABASE_ANON_KEY="$ANON_KEY" \
SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY" \
LOCAL_TTS_BASE_URL="http://127.0.0.1:3000" \
ENABLE_LOCAL_TTS="true" \
TTS_PROVIDER="$SELECTED_TTS_PROVIDER" \
OPENAI_API_KEY="${OPENAI_API_KEY:-}" \
OPENAI_TTS_MODEL="${OPENAI_TTS_MODEL:-}" \
OPENAI_TTS_VOICE_JA="${OPENAI_TTS_VOICE_JA:-}" \
OPENAI_TTS_VOICE_EN="${OPENAI_TTS_VOICE_EN:-}" \
OPENAI_TTS_FORMAT="${OPENAI_TTS_FORMAT:-}" \
OPENAI_TTS_SPEED="${OPENAI_TTS_SPEED:-}" \
STRIPE_SECRET_KEY="sk_test_local" \
STRIPE_WEBHOOK_SECRET="whsec_local" \
npm run dev >"$NEXT_LOG_FILE" 2>&1 &
NEXT_PID=$!

if wait_for_next; then
  pass "next dev server"
else
  tail -n 100 "$NEXT_LOG_FILE" >&2 || true
  fail "next dev server"
fi

EPISODE_DATE_BASE="${EPISODE_DATE:-$(date +%F)}"
EPISODE_DATE_1="$EPISODE_DATE_BASE"
EPISODE_DATE_2="$(date_add_days "$EPISODE_DATE_BASE" 1)"
EPISODE_DATE_3="$(date_add_days "$EPISODE_DATE_BASE" 2)"

log "execute daily-generate pipeline #1"
DAILY_1="$(run_daily_generate_with_retry "$EPISODE_DATE_1")"
if grep -Fq "\"ok\":true" <<<"$DAILY_1"; then
  pass "daily-generate pipeline #1"
else
  print_daily_failure_diagnostics "daily-generate pipeline #1" "$DAILY_1"
  fail "daily-generate pipeline #1"
fi

log "execute daily-generate pipeline #2"
DAILY_2="$(run_daily_generate_with_retry "$EPISODE_DATE_2")"
if grep -Fq "\"ok\":true" <<<"$DAILY_2"; then
  pass "daily-generate pipeline #2"
else
  print_daily_failure_diagnostics "daily-generate pipeline #2" "$DAILY_2"
  fail "daily-generate pipeline #2"
fi

JA_PUBLISHED_COUNT="$(psql_query "select count(*) from public.episodes where lang='ja' and status='published' and published_at is not null;")"
EN_PUBLISHED_LINKED_COUNT="$(psql_query "select count(*) from public.episodes en join public.episodes ja on en.master_id = ja.id where en.lang='en' and en.status='published' and en.published_at is not null and ja.lang='ja';")"

assert_count_ge "episodes.ja published rows" "$JA_PUBLISHED_COUNT" 2
assert_count_ge "episodes.en published rows linked to ja" "$EN_PUBLISHED_LINKED_COUNT" 2

for episode_date in "$EPISODE_DATE_1" "$EPISODE_DATE_2"; do
  JA_TITLE_COUNT="$(psql_query "select count(*) from public.episodes where lang='ja' and title='Daily Topic ${episode_date} (JA)';")"
  EN_TITLE_COUNT="$(psql_query "select count(*) from public.episodes where lang='en' and title='Daily Topic ${episode_date} (EN)';")"
  assert_count_eq "no duplicate ja episode for ${episode_date}" "$JA_TITLE_COUNT" 1
  assert_count_eq "no duplicate en episode for ${episode_date}" "$EN_TITLE_COUNT" 1
done

LOCAL_AUDIO_URL_COUNT="$(psql_query "select count(*) from public.episodes where lang in ('ja','en') and status='published' and audio_url like '/audio/%';")"
assert_count_ge "episodes audio_url uses local /audio path" "$LOCAL_AUDIO_URL_COUNT" 4

LATEST_JA_AUDIO_URL="$(psql_query "select coalesce(audio_url,'') from public.episodes where lang='ja' and status='published' order by published_at desc nulls last, created_at desc limit 1;")"
assert_contains "ja audio_url path prefix" "$LATEST_JA_AUDIO_URL" "/audio/"
if [ -f "public${LATEST_JA_AUDIO_URL}" ]; then
  pass "ja audio file exists under public/"
else
  fail "ja audio file exists under public/"
fi

EXPECTED_JOB_TYPES=("daily-generate" "plan-topics" "write-script-ja" "polish-script-ja" "tts-ja" "adapt-script-en" "polish-script-en" "tts-en" "publish")
for job_type in "${EXPECTED_JOB_TYPES[@]}"; do
  JOB_TYPE_COUNT="$(psql_query "select count(*) from public.job_runs where job_type='${job_type}';")"
  assert_count_ge "job_runs history for ${job_type}" "$JOB_TYPE_COUNT" 2
done

POLISH_JA_PAYLOAD_COUNT="$(psql_query "select count(*) from public.job_runs where job_type='polish-script-ja' and (payload ? 'input_chars') and (payload ? 'output_chars') and (payload ? 'parse_ok') and (payload ? 'fallback_used') and (payload ? 'error_summary');")"
POLISH_EN_PAYLOAD_COUNT="$(psql_query "select count(*) from public.job_runs where job_type='polish-script-en' and (payload ? 'input_chars') and (payload ? 'output_chars') and (payload ? 'parse_ok') and (payload ? 'fallback_used') and (payload ? 'error_summary');")"
assert_count_ge "polish-script-ja payload observability fields" "$POLISH_JA_PAYLOAD_COUNT" 2
assert_count_ge "polish-script-en payload observability fields" "$POLISH_EN_PAYLOAD_COUNT" 2

POLISH_JA_PAYLOAD_V2_COUNT="$(psql_query "select count(*) from public.job_runs where job_type='polish-script-ja' and (payload ? 'lang') and (payload ? 'attempt') and (payload ? 'before_chars') and (payload ? 'after_chars') and (payload ? 'skipped_reason');")"
POLISH_EN_PAYLOAD_V2_COUNT="$(psql_query "select count(*) from public.job_runs where job_type='polish-script-en' and (payload ? 'lang') and (payload ? 'attempt') and (payload ? 'before_chars') and (payload ? 'after_chars') and (payload ? 'skipped_reason');")"
assert_count_ge "polish-script-ja payload v2 fields" "$POLISH_JA_PAYLOAD_V2_COUNT" 2
assert_count_ge "polish-script-en payload v2 fields" "$POLISH_EN_PAYLOAD_V2_COUNT" 2

POLISHED_SCRIPT_COUNT="$(psql_query "select count(*) from public.episodes where lang in ('ja','en') and coalesce(script_polished,'') <> '';")"
assert_count_ge "episodes script_polished saved for ja/en" "$POLISHED_SCRIPT_COUNT" 4

if [ "${E2E_OPENAI_PROVIDER:-0}" = "1" ]; then
  if [ "$SELECTED_TTS_PROVIDER" != "openai" ]; then
    pass "openai provider verification skipped (TTS_PROVIDER=${SELECTED_TTS_PROVIDER})"
  elif [ -z "${OPENAI_API_KEY:-}" ]; then
    pass "openai provider verification skipped (OPENAI_API_KEY missing)"
  else
    OPENAI_PROVIDER_RUN_COUNT="$(psql_query "select count(*) from public.job_runs where job_type in ('tts-ja','tts-en') and payload->>'tts_provider'='openai';")"
    assert_count_ge "openai tts provider job_runs evidence" "$OPENAI_PROVIDER_RUN_COUNT" 2
  fi
fi

log "force failed publish run to verify job_runs.error"
curl -sS -X POST "$FUNCTIONS_URL/publish" -H "Content-Type: application/json" -d "{\"episodeDate\":\"$EPISODE_DATE_2\",\"episodeIdJa\":\"00000000-0000-0000-0000-000000000000\",\"episodeIdEn\":\"00000000-0000-0000-0000-000000000000\"}" >/dev/null

FAILED_RUNS_WITH_ERROR="$(psql_query "select count(*) from public.job_runs where status='failed' and error is not null and length(error) > 0;")"
assert_count_ge "job_runs failed rows keep error text" "$FAILED_RUNS_WITH_ERROR" 1

EPISODES_HTML="$(curl -sS "http://127.0.0.1:3000/episodes")"
assert_contains_any "/episodes renders title heading" "$EPISODES_HTML" "Title" "タイトル"
assert_contains_any "/episodes renders language heading" "$EPISODES_HTML" "Language" "言語"
assert_contains_any "/episodes renders published_at heading" "$EPISODES_HTML" "Published At" "公開日時"

SAMPLE_TITLE="$(psql_query "select coalesce(title,'') from public.episodes where status='published' and published_at is not null order by published_at desc limit 1;")"
if [ -n "$SAMPLE_TITLE" ]; then
  assert_contains "/episodes displays row from DB" "$EPISODES_HTML" "$SAMPLE_TITLE"
else
  fail "/episodes displays row from DB"
fi

log "insert letter via api"
LETTER_TEXT="hello from e2e-local"
LETTERS_RESPONSE="$(curl -sS -X POST "http://127.0.0.1:3000/api/letters" -H "Content-Type: application/json" -d "{\"displayName\":\"local-e2e\",\"text\":\"${LETTER_TEXT}\"}")"
assert_contains "letters api insert" "$LETTERS_RESPONSE" "\"ok\":true"

LETTERS_COUNT="$(psql_query "select count(*) from public.letters where display_name='local-e2e' and text='${LETTER_TEXT}' and created_at is not null;")"
assert_count_ge "letters table accepts inserts with created_at" "$LETTERS_COUNT" 1

log "reject letter with ng word"
NG_RESPONSE_STATUS="$(curl -sS -o "$TMP_DIR/letters-ng.json" -w "%{http_code}" -X POST "http://127.0.0.1:3000/api/letters" -H "Content-Type: application/json" -d "{\"displayName\":\"local-e2e-ng\",\"text\":\"死ねと言われて悲しかった\"}")"
NG_RESPONSE_BODY="$(cat "$TMP_DIR/letters-ng.json")"
assert_count_eq "letters api rejects ng word with 400" "$NG_RESPONSE_STATUS" 400
assert_contains "letters api ng word returns validation_error" "$NG_RESPONSE_BODY" "\"validation_error\""

NG_INSERTED_COUNT="$(psql_query "select count(*) from public.letters where display_name='local-e2e-ng';")"
assert_count_eq "letters api ng word is not inserted" "$NG_INSERTED_COUNT" 0

log "verify daily-generate skips blocked letters"
psql_query "update public.letters set is_used=true where is_used=false and is_blocked=false;" >/dev/null
BLOCKED_LETTER_ID="$(psql_query "insert into public.letters (display_name, text, moderation_status, is_used, is_blocked, blocked_reason) values ('blocked-e2e', '絶対に儲かる株を買えば100%勝てる', 'pending', false, true, 'manual_e2e_blocked') returning id;" | head -n 1)"
SAFE_LETTER_ID="$(psql_query "insert into public.letters (display_name, text, moderation_status, is_used, is_blocked) values ('safe-e2e', '最近の配信も楽しみにしています。', 'pending', false, false) returning id;" | head -n 1)"

DAILY_3="$(run_daily_generate_with_retry "$EPISODE_DATE_3")"
if grep -Fq "\"ok\":true" <<<"$DAILY_3"; then
  pass "daily-generate pipeline #3"
else
  print_daily_failure_diagnostics "daily-generate pipeline #3" "$DAILY_3"
  fail "daily-generate pipeline #3"
fi
assert_contains "daily-generate uses unblocked letter" "$DAILY_3" "$SAFE_LETTER_ID"
assert_not_contains "daily-generate does not use blocked letter" "$DAILY_3" "$BLOCKED_LETTER_ID"

BLOCKED_USED_COUNT="$(psql_query "select count(*) from public.letters where id='${BLOCKED_LETTER_ID}' and is_used=true;")"
assert_count_eq "blocked letter remains unused" "$BLOCKED_USED_COUNT" 0

JA_PUBLISHED_COUNT_AFTER_THREE="$(psql_query "select count(*) from public.episodes where lang='ja' and status='published' and published_at is not null;")"
EN_PUBLISHED_COUNT_AFTER_THREE="$(psql_query "select count(*) from public.episodes where lang='en' and status='published' and published_at is not null;")"
assert_count_ge "episodes.ja published rows after 3 runs" "$JA_PUBLISHED_COUNT_AFTER_THREE" 3
assert_count_ge "episodes.en published rows after 3 runs" "$EN_PUBLISHED_COUNT_AFTER_THREE" 3

for episode_date in "$EPISODE_DATE_1" "$EPISODE_DATE_2" "$EPISODE_DATE_3"; do
  JA_TITLE_COUNT="$(psql_query "select count(*) from public.episodes where lang='ja' and title='Daily Topic ${episode_date} (JA)';")"
  EN_TITLE_COUNT="$(psql_query "select count(*) from public.episodes where lang='en' and title='Daily Topic ${episode_date} (EN)';")"
  assert_count_eq "ja episode generated for ${episode_date}" "$JA_TITLE_COUNT" 1
  assert_count_eq "en episode generated for ${episode_date}" "$EN_TITLE_COUNT" 1

  JA_SCRIPT="$(psql_query "select coalesce(script,'') from public.episodes where lang='ja' and title='Daily Topic ${episode_date} (JA)' limit 1;")"
  assert_script_quality "ja script quality gate for ${episode_date}" "$JA_SCRIPT"
done

DAILY_RECENT_SUCCESS_COUNT="$(psql_query "select count(*) from (select id from public.job_runs where job_type='daily-generate' and status='success' order by created_at desc limit 3) t;")"
assert_count_eq "daily-generate has 3 recent success runs" "$DAILY_RECENT_SUCCESS_COUNT" 3

DAILY_RECENT_CHARS_RANGE_COUNT="$(psql_query "with recent as (select payload from public.job_runs where job_type='daily-generate' and status='success' order by created_at desc limit 3) select count(*) from recent where (payload->'scriptMetrics'->>'chars_actual') ~ '^[0-9]+$' and (payload->'scriptMetrics'->>'chars_actual')::int between 5500 and 9000;")"
assert_count_eq "daily-generate chars_actual in 5500-9000 for recent 3 runs" "$DAILY_RECENT_CHARS_RANGE_COUNT" 3

DAILY_RECENT_BREAKDOWN_COUNT="$(psql_query "with recent as (select payload from public.job_runs where job_type='daily-generate' and status='success' order by created_at desc limit 3) select count(*) from recent where jsonb_typeof(payload->'scriptMetrics'->'sections_chars_breakdown')='object';")"
assert_count_eq "daily-generate records sections_chars_breakdown for recent 3 runs" "$DAILY_RECENT_BREAKDOWN_COUNT" 3

DAILY_RECENT_EXPAND_COUNT="$(psql_query "with recent as (select payload from public.job_runs where job_type='daily-generate' and status='success' order by created_at desc limit 3) select count(*) from recent where (payload->'scriptMetrics') ? 'expand_attempted';")"
assert_count_eq "daily-generate records expand_attempted for recent 3 runs" "$DAILY_RECENT_EXPAND_COUNT" 3

DAILY_RECENT_ITEMS_COUNT="$(psql_query "with recent as (select payload from public.job_runs where job_type='daily-generate' and status='success' order by created_at desc limit 3) select count(*) from recent where jsonb_typeof(payload->'scriptMetrics'->'items_used_count')='object';")"
assert_count_eq "daily-generate records items_used_count for recent 3 runs" "$DAILY_RECENT_ITEMS_COUNT" 3

MISSING_SIG_STATUS="$(curl -sS -o "$TMP_DIR/stripe-missing-signature.json" -w "%{http_code}" -X POST "http://127.0.0.1:3000/api/stripe/webhook" -H "Content-Type: application/json" -d "{}")"
MISSING_SIG_BODY="$(cat "$TMP_DIR/stripe-missing-signature.json")"
assert_count_eq "stripe webhook rejects missing signature with 400" "$MISSING_SIG_STATUS" 400
assert_contains "stripe webhook missing signature error body" "$MISSING_SIG_BODY" "missing_stripe_signature"

TIP_PAYMENT_ID="pi_e2e_${EPISODE_DATE_3//-/}_001"
read -r STRIPE_SIGNATURE STRIPE_PAYLOAD <<EOF
$(node -e "const Stripe=require('stripe'); const paymentId=process.argv[1]; const payload=JSON.stringify({id:'evt_'+paymentId,object:'event',type:'payment_intent.succeeded',data:{object:{id:paymentId,object:'payment_intent',amount_received:500,currency:'jpy'}}}); const signature=Stripe.webhooks.generateTestHeaderString({payload,secret:'whsec_local'}); process.stdout.write(signature + ' ' + payload);" "$TIP_PAYMENT_ID")
EOF

WEBHOOK_RESPONSE_1="$(curl -sS -X POST "http://127.0.0.1:3000/api/stripe/webhook" -H "Content-Type: application/json" -H "stripe-signature: ${STRIPE_SIGNATURE}" --data "${STRIPE_PAYLOAD}")"
assert_contains "stripe webhook first insert succeeds" "$WEBHOOK_RESPONSE_1" "\"ok\":true"

WEBHOOK_RESPONSE_2="$(curl -sS -X POST "http://127.0.0.1:3000/api/stripe/webhook" -H "Content-Type: application/json" -H "stripe-signature: ${STRIPE_SIGNATURE}" --data "${STRIPE_PAYLOAD}")"
assert_contains "stripe webhook duplicate is no-op" "$WEBHOOK_RESPONSE_2" "\"duplicate\":true"

TIPS_COUNT="$(psql_query "select count(*) from public.tips where provider_payment_id='${TIP_PAYMENT_ID}';")"
assert_count_eq "tips.provider_payment_id unique behavior" "$TIPS_COUNT" 1

printf "\n[RESULT] PASS (%s checks)\n" "$PASS_COUNT"
