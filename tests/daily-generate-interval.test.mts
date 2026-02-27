import test from "node:test";
import assert from "node:assert/strict";
import { shouldSkipGenerationByInterval } from "../supabase/functions/_shared/dailyGenerateInterval.ts";

test("skip when last episode is yesterday and interval is 2 days", () => {
  const skipped = shouldSkipGenerationByInterval({
    requestedEpisodeDate: "2026-02-12",
    lastEpisodeDate: "2026-02-11",
    intervalDays: 2,
    force: false
  });

  assert.equal(skipped, true);
});

test("run when last episode is exactly interval days ago", () => {
  const skipped = shouldSkipGenerationByInterval({
    requestedEpisodeDate: "2026-02-12",
    lastEpisodeDate: "2026-02-10",
    intervalDays: 2,
    force: false
  });

  assert.equal(skipped, false);
});

test("run when force=true even if interval is not reached", () => {
  const skipped = shouldSkipGenerationByInterval({
    requestedEpisodeDate: "2026-02-12",
    lastEpisodeDate: "2026-02-11",
    intervalDays: 2,
    force: true
  });

  assert.equal(skipped, false);
});

