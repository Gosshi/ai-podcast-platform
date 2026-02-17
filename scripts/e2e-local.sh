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
  if printf "%s" "$haystack" | grep -Fq "$needle"; then
    pass "$label"
  else
    fail "$label"
  fi
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

EPISODE_DATE="${EPISODE_DATE:-$(date +%F)}"

log "execute daily-generate pipeline #1"
DAILY_1="$(curl -sS -X POST "$FUNCTIONS_URL/daily-generate" -H "Content-Type: application/json" -d "{\"episodeDate\":\"$EPISODE_DATE\"}")"
if printf "%s" "$DAILY_1" | grep -Fq "\"ok\":true"; then
  pass "daily-generate pipeline #1"
else
  printf "%s\n" "$DAILY_1" >&2
  fail "daily-generate pipeline #1"
fi

log "execute daily-generate pipeline #2"
DAILY_2="$(curl -sS -X POST "$FUNCTIONS_URL/daily-generate" -H "Content-Type: application/json" -d "{\"episodeDate\":\"$EPISODE_DATE\"}")"
if printf "%s" "$DAILY_2" | grep -Fq "\"ok\":true"; then
  pass "daily-generate pipeline #2"
else
  printf "%s\n" "$DAILY_2" >&2
  fail "daily-generate pipeline #2"
fi

JA_PUBLISHED_COUNT="$(psql_query "select count(*) from public.episodes where lang='ja' and status='published' and published_at is not null;")"
EN_PUBLISHED_LINKED_COUNT="$(psql_query "select count(*) from public.episodes en join public.episodes ja on en.master_id = ja.id where en.lang='en' and en.status='published' and en.published_at is not null and ja.lang='ja';")"

assert_count_ge "episodes.ja published rows" "$JA_PUBLISHED_COUNT" 1
assert_count_ge "episodes.en published rows linked to ja" "$EN_PUBLISHED_LINKED_COUNT" 1

EXPECTED_JOB_TYPES=("daily-generate" "plan-topics" "write-script-ja" "tts-ja" "adapt-script-en" "tts-en" "publish")
for job_type in "${EXPECTED_JOB_TYPES[@]}"; do
  JOB_TYPE_COUNT="$(psql_query "select count(*) from public.job_runs where job_type='${job_type}';")"
  assert_count_ge "job_runs history for ${job_type}" "$JOB_TYPE_COUNT" 2
done

log "force failed publish run to verify job_runs.error"
curl -sS -X POST "$FUNCTIONS_URL/publish" -H "Content-Type: application/json" -d "{\"episodeDate\":\"$EPISODE_DATE\",\"episodeIdJa\":\"00000000-0000-0000-0000-000000000000\",\"episodeIdEn\":\"00000000-0000-0000-0000-000000000000\"}" >/dev/null

FAILED_RUNS_WITH_ERROR="$(psql_query "select count(*) from public.job_runs where status='failed' and error is not null and length(error) > 0;")"
assert_count_ge "job_runs failed rows keep error text" "$FAILED_RUNS_WITH_ERROR" 1

log "start next dev server"
SUPABASE_URL="$API_URL" \
SUPABASE_ANON_KEY="$ANON_KEY" \
SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY" \
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

EPISODES_HTML="$(curl -sS "http://127.0.0.1:3000/episodes")"
assert_contains "/episodes renders title heading" "$EPISODES_HTML" "Title"
assert_contains "/episodes renders language heading" "$EPISODES_HTML" "Language"
assert_contains "/episodes renders published_at heading" "$EPISODES_HTML" "Published At"

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

MISSING_SIG_STATUS="$(curl -sS -o "$TMP_DIR/stripe-missing-signature.json" -w "%{http_code}" -X POST "http://127.0.0.1:3000/api/stripe/webhook" -H "Content-Type: application/json" -d "{}")"
MISSING_SIG_BODY="$(cat "$TMP_DIR/stripe-missing-signature.json")"
assert_count_eq "stripe webhook rejects missing signature with 400" "$MISSING_SIG_STATUS" 400
assert_contains "stripe webhook missing signature error body" "$MISSING_SIG_BODY" "missing_stripe_signature"

TIP_PAYMENT_ID="pi_e2e_${EPISODE_DATE//-/}_001"
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
