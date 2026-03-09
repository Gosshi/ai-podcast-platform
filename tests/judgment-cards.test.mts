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
  assert.equal(cards[0]?.watch_points.length >= 3, true);
});

test("extractJudgmentCards returns empty when script is missing", () => {
  assert.deepEqual(extractJudgmentCards(null), []);
});
