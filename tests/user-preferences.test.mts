import assert from "node:assert/strict";
import test from "node:test";
import { initializeUserPreferenceProfile, validateUserPreferencesInput } from "../src/lib/userPreferences.ts";

test("validateUserPreferencesInput normalizes ordered selections and keeps none exclusive", () => {
  const result = validateUserPreferencesInput({
    interestTopics: ["tech", "games", "tech", "movies"],
    activeSubscriptions: ["none", "spotify", "youtube"],
    decisionPriority: "save_time",
    dailyAvailableTime: "30-60"
  });

  assert.equal(result.ok, true);
  if (!result.ok) {
    return;
  }

  assert.deepEqual(result.value.interestTopics, ["games", "movies", "tech"]);
  assert.deepEqual(result.value.activeSubscriptions, ["spotify", "youtube"]);
  assert.equal(result.value.decisionPriority, "save_time");
  assert.equal(result.value.dailyAvailableTime, "30-60");
});

test("initializeUserPreferenceProfile derives cold-start preference signals", () => {
  const profile = initializeUserPreferenceProfile({
    interestTopics: ["anime", "streaming"],
    activeSubscriptions: ["prime", "spotify"],
    decisionPriority: "discover_new",
    dailyAvailableTime: "2h+"
  });

  assert.equal(profile.primaryInterestTopic, "anime");
  assert.equal(profile.discoveryMode, true);
  assert.equal(profile.moneySensitive, false);
  assert.equal(profile.timeSensitive, false);
  assert.equal(profile.regretAverse, false);
  assert.equal(profile.dailyTimeBudget, "flexible");
  assert.equal(profile.topicAffinities.anime, 1);
  assert.equal(profile.topicAffinities.tech, 0);
  assert.equal(profile.hasActiveSubscriptions, true);
});
