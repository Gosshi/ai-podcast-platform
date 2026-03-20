import test from "node:test";
import assert from "node:assert/strict";
import {
  getStripeTrialConsumedStatuses,
  hasConsumedStripeTrial,
  resolveStripeTrialDays
} from "../app/lib/stripeTrial.ts";

test("resolveStripeTrialDays defaults to 7 days", () => {
  assert.equal(resolveStripeTrialDays(undefined), 7);
  assert.equal(resolveStripeTrialDays(""), 7);
  assert.equal(resolveStripeTrialDays("not-a-number"), 7);
});

test("resolveStripeTrialDays allows disabling and clamps large values", () => {
  assert.equal(resolveStripeTrialDays("0"), 0);
  assert.equal(resolveStripeTrialDays("7"), 7);
  assert.equal(resolveStripeTrialDays("90"), 30);
});

test("hasConsumedStripeTrial only treats real paid lifecycle statuses as consumed", () => {
  assert.equal(hasConsumedStripeTrial("trialing"), true);
  assert.equal(hasConsumedStripeTrial("active"), true);
  assert.equal(hasConsumedStripeTrial("canceled"), true);
  assert.equal(hasConsumedStripeTrial("inactive"), false);
  assert.equal(hasConsumedStripeTrial("incomplete"), false);
  assert.equal(hasConsumedStripeTrial("incomplete_expired"), false);
  assert.equal(hasConsumedStripeTrial(null), false);
});

test("getStripeTrialConsumedStatuses exposes the statuses used for trial eligibility", () => {
  assert.deepEqual(getStripeTrialConsumedStatuses(), [
    "trialing",
    "active",
    "past_due",
    "canceled",
    "unpaid",
    "paused"
  ]);
});
