#!/usr/bin/env bash

set -euo pipefail

MODE="${1:-}"
TOPIC="${*:2}"

if [[ -z "$MODE" ]]; then
  echo "usage: scripts/ai-loop.sh <review|fix|verify|issue-fix> [topic]" >&2
  exit 1
fi

case "$MODE" in
  review)
    PROMPT="ai/prompts/review.md"
    TEMPLATE="ai/templates/review-report.md"
    STATUS="review"
    ;;
  fix)
    PROMPT="ai/prompts/fix.md"
    TEMPLATE="ai/templates/fix-plan.md"
    STATUS="fixing"
    ;;
  verify)
    PROMPT="ai/prompts/verify.md"
    TEMPLATE="ai/templates/verification-report.md"
    STATUS="verifying"
    ;;
  issue-fix)
    PROMPT="ai/prompts/issue-fix.md"
    TEMPLATE="ai/templates/fix-plan.md"
    STATUS="fixing"
    ;;
  *)
    echo "unknown mode: $MODE" >&2
    exit 1
    ;;
esac

slugify() {
  printf '%s' "$1" \
    | tr '[:upper:]' '[:lower:]' \
    | sed -E 's/[^a-z0-9]+/-/g; s/^-+//; s/-+$//'
}

DATE="$(date +%F)"
TOPIC_SLUG="$(slugify "${TOPIC:-general}")"
RUN_FILE="ai/runs/${DATE}-${TOPIC_SLUG}.md"

mkdir -p ai/runs

if ! (
  set -o noclobber
  cat > "$RUN_FILE" <<EOF
# AI Run: ${TOPIC_SLUG}

- Date: ${DATE}
- Status: ${STATUS}
- Scope:

## 背景

## レビュー結果

## 修正対象

## 修正内容

## 検証結果

## 残課題
EOF
) 2>/dev/null; then
  :
fi

perl -0pi -e 's/^- Status:.*$/- Status: '"$STATUS"'/m' "$RUN_FILE"

cat <<EOF
Mode: ${MODE}
Prompt: ${PROMPT}
Template: ${TEMPLATE}
Run log: ${RUN_FILE}

Next:
1. Open ${PROMPT}
2. Use ${RUN_FILE} as the working log
3. Save output in the matching section
EOF
