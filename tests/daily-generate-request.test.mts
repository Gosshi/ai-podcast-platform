import test from "node:test";
import assert from "node:assert/strict";
import { parseDailyGenerateRequest } from "../supabase/functions/_shared/dailyGenerateRequest.ts";

test("defaults to JST today, general genre, and force=false", () => {
  const result = parseDailyGenerateRequest({}, new Date("2026-02-27T15:30:00.000Z"));
  assert.equal(result.ok, true);
  if (!result.ok) return;

  assert.deepEqual(result.requestEcho, {
    episodeDate: "2026-02-28",
    genre: "general",
    force: false
  });
});

test("accepts explicit episodeDate, genre, and force", () => {
  const result = parseDailyGenerateRequest({
    episodeDate: "2026-03-01",
    genre: "entertainment",
    force: true
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;

  assert.deepEqual(result.requestEcho, {
    episodeDate: "2026-03-01",
    genre: "entertainment",
    force: true
  });
});

test("returns validation_error for invalid episodeDate format", () => {
  const result = parseDailyGenerateRequest({ episodeDate: "03-01-2026" });
  assert.equal(result.ok, false);
  if (result.ok) return;

  assert.equal(result.error, "validation_error");
  assert.equal(result.status, 400);
});

