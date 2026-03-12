import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { extractJudgmentCards } from "../src/lib/judgmentCards.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test("extractJudgmentCards parses deep dive decisions", async () => {
  const samplePath = path.resolve(__dirname, "..", "tmp", "judgment-support-script-ja-personal-framework.txt");
  const sample = await readFile(samplePath, "utf8");
  const cards = extractJudgmentCards(sample);

  assert.equal(cards.length, 3);
  assert.equal(cards[0]?.topic_title.includes("Steam Next Fest"), true);
  assert.equal(cards[0]?.frame_type, "Frame A");
  assert.equal(cards[0]?.judgment_type, "watch");
  assert.equal(cards[0]?.judgment_summary, "今日は検討継続。");
  assert.equal(cards[0]?.action_text, "体験版で採点が3項目中2項目未達なら見送る。");
  assert.equal(cards[0]?.deadline_at, "2026-02-26T14:59:00.000Z");
  assert.equal(cards[0]?.threshold_json.unit_cost?.[0]?.value, 300);
  assert.equal(cards[0]?.watch_points.length >= 3, true);
});

test("extractJudgmentCards returns empty when script is missing", () => {
  assert.deepEqual(extractJudgmentCards(null), []);
});

test("extractJudgmentCards parses english decision blocks when explicit fields exist", () => {
  const script = `
[OPENING]
Welcome back.

[MAIN TOPIC 1]
Headline: Streaming bundle update
Decision frame: Frame B
Decision summary: Keep watching this bundle for now until the cost per hour improves.
Action: Re-check monthly viewing hours before renewing.
Deadline: 2026-03-20T12:00:00Z
Watchpoints: monthly fee, hours watched, cost per hour
`.trim();

  const cards = extractJudgmentCards(script);
  assert.equal(cards.length, 1);
  assert.equal(cards[0]?.judgment_type, "watch");
  assert.equal(cards[0]?.deadline_at, "2026-03-20T12:00:00.000Z");
  assert.deepEqual(cards[0]?.watch_points, ["monthly fee", "hours watched", "cost per hour"]);
});
