#!/usr/bin/env bash
# Generate TTS audio for all seed episodes.
# Requires: dev server running on localhost:3000
# Uses the local TTS provider (macOS) or OpenAI (if configured).
#
# Usage:
#   ./scripts/generate-seed-audio.sh

set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"

EPISODE_IDS=(
  "10000000-0000-0000-0000-000000000001"
  "10000000-0000-0000-0000-000000000002"
  "10000000-0000-0000-0000-000000000003"
  "10000000-0000-0000-0000-000000000004"
  "10000000-0000-0000-0000-000000000005"
)

echo "🎙️  Generating audio for seed episodes..."
echo "   Base URL: ${BASE_URL}"
echo ""

for id in "${EPISODE_IDS[@]}"; do
  echo "→ Episode: ${id}"
  response=$(curl -sS -X POST "${BASE_URL}/api/tts" \
    -H "Content-Type: application/json" \
    -d "{\"episodeId\": \"${id}\", \"lang\": \"ja\", \"format\": \"mp3\"}" \
    2>&1) || true

  ok=$(echo "$response" | jq -r '.ok // false' 2>/dev/null || echo "false")

  if [ "$ok" = "true" ]; then
    audio_url=$(echo "$response" | jq -r '.audioUrl')
    provider=$(echo "$response" | jq -r '.provider')
    echo "  ✅ ${audio_url} (${provider})"
  else
    error=$(echo "$response" | jq -r '.message // .error // "unknown"' 2>/dev/null || echo "$response")
    echo "  ❌ Failed: ${error}"
  fi
  echo ""
done

echo "Done. Update episodes.audio_url in Supabase to point to the generated files."
