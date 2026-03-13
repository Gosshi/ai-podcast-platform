import assert from "node:assert/strict";
import test from "node:test";
import {
  buildUserPreferenceSurfaceContext,
  initializeUserPreferenceProfile,
  validateUserPreferencesInput
} from "../src/lib/userPreferences.ts";

test("validateUserPreferencesInput normalizes ordered selections and keeps none exclusive", () => {
  const result = validateUserPreferencesInput({
    interestTopics: ["tech", "games", "tech", "movies"],
    activeSubscriptions: ["none", "spotify", "youtube", "chatgpt"],
    decisionPriority: "save_time",
    dailyAvailableTime: "30_to_60m",
    budgetSensitivity: "high"
  });

  assert.equal(result.ok, true);
  if (!result.ok) {
    return;
  }

  assert.deepEqual(result.value.interestTopics, ["games", "movies", "tech"]);
  assert.deepEqual(result.value.activeSubscriptions, ["spotify", "youtube", "chatgpt"]);
  assert.equal(result.value.decisionPriority, "save_time");
  assert.equal(result.value.dailyAvailableTime, "30_to_60m");
  assert.equal(result.value.budgetSensitivity, "high");
});

test("validateUserPreferencesInput accepts legacy daily time values and optional budget omission", () => {
  const result = validateUserPreferencesInput({
    interestTopics: ["anime"],
    activeSubscriptions: ["none"],
    decisionPriority: "avoid_regret",
    dailyAvailableTime: "<30min"
  });

  assert.equal(result.ok, true);
  if (!result.ok) {
    return;
  }

  assert.equal(result.value.dailyAvailableTime, "under_30m");
  assert.equal(result.value.budgetSensitivity, null);
});

test("initializeUserPreferenceProfile derives cold-start preference signals", () => {
  const profile = initializeUserPreferenceProfile({
    interestTopics: ["anime", "streaming"],
    activeSubscriptions: ["prime", "spotify", "chatgpt"],
    decisionPriority: "discover_new",
    dailyAvailableTime: "over_2h",
    budgetSensitivity: "medium"
  });

  assert.equal(profile.primaryInterestTopic, "anime");
  assert.equal(profile.discoveryMode, true);
  assert.equal(profile.moneySensitive, false);
  assert.equal(profile.timeSensitive, false);
  assert.equal(profile.regretAverse, false);
  assert.equal(profile.dailyTimeBudget, "flexible");
  assert.equal(profile.budgetFlexibility, "balanced");
  assert.equal(profile.topicAffinities.anime, 1);
  assert.equal(profile.topicAffinities.tech, 0);
  assert.equal(profile.hasActiveSubscriptions, true);
  assert.equal(profile.activeSubscriptionCount, 3);
});

test("buildUserPreferenceSurfaceContext prepares explicit preference handoff for future surfaces", () => {
  const profile = initializeUserPreferenceProfile({
    interestTopics: ["games", "tech"],
    activeSubscriptions: ["netflix", "other"],
    decisionPriority: "save_money",
    dailyAvailableTime: "1_to_2h",
    budgetSensitivity: "high"
  });
  const surfaceContext = buildUserPreferenceSurfaceContext(profile);

  assert.equal(surfaceContext?.nextBestDecision.decisionPriority, "save_money");
  assert.equal(surfaceContext?.personalHints.moneySensitive, true);
  assert.equal(surfaceContext?.watchlistAlerts.dailyTimeBudget, "steady");
  assert.equal(surfaceContext?.paywallCopy.activeSubscriptionCount, 2);
  assert.deepEqual(surfaceContext?.weeklyDigest.interestTopics, ["games", "tech"]);
});
