import assert from "node:assert/strict";
import test from "node:test";
import {
  MIN_PROFILE_HISTORY,
  MIN_SEGMENT_HISTORY,
  buildPersonalDecisionHint,
  buildPersonalDecisionProfile
} from "../src/lib/decisionProfile.ts";

test("buildPersonalDecisionProfile aggregates outcomes, frames, genres, and insights", () => {
  const profile = buildPersonalDecisionProfile([
    {
      decision_type: "use_now",
      outcome: "success",
      frame_type: "Frame A",
      genre: "entertainment",
      threshold_json: {
        time_limit: [{ raw: "2時間", value: 2, unit: "hour" }]
      }
    },
    {
      decision_type: "use_now",
      outcome: "success",
      frame_type: "Frame A",
      genre: "entertainment",
      threshold_json: {
        time_limit: [{ raw: "90分", value: 90, unit: "minute" }]
      }
    },
    {
      decision_type: "watch",
      outcome: "neutral",
      frame_type: "Frame A",
      genre: "entertainment",
      threshold_json: {
        ratio: [{ raw: "20%", value: 20, unit: "PERCENT" }]
      }
    },
    {
      decision_type: "watch",
      outcome: "regret",
      frame_type: "Frame C",
      genre: "ads",
      threshold_json: {
        ad_time: [{ raw: "8分", value: 8, unit: "minute" }]
      }
    },
    {
      decision_type: "skip",
      outcome: "regret",
      frame_type: "Frame C",
      genre: "ads",
      threshold_json: {
        ad_time: [{ raw: "10分", value: 10, unit: "minute" }]
      }
    },
    {
      decision_type: "watch",
      outcome: "neutral",
      frame_type: "Frame C",
      genre: "ads",
      threshold_json: {
        ad_time: [{ raw: "12分", value: 12, unit: "minute" }]
      }
    }
  ]);

  assert.equal(profile.totalDecisions, 6);
  assert.equal(profile.minimumHistoryMet, true);
  assert.equal(profile.decisionRatios.use_now.percentage, 33);
  assert.equal(profile.outcomeRatios.regret.percentage, 33);
  assert.equal(profile.bestFrameType?.key, "Frame A");
  assert.equal(profile.riskyFrameType?.key, "Frame C");
  assert.equal(profile.topGenres.some((genre) => genre.key === "ads"), true);
  assert.equal(profile.regretGenres[0]?.key, "ads");
  assert.equal(profile.signalStats[0]?.key, "ad_time");
  assert.equal(profile.insights.length > 0, true);
  assert.equal(profile.insights.some((insight) => insight.key.startsWith("frame-success:Frame A")), true);
  assert.equal(profile.insights.some((insight) => insight.key.startsWith("genre-regret:ads")), true);
});

test("buildPersonalDecisionProfile suppresses insights before minimum history", () => {
  const profile = buildPersonalDecisionProfile(
    Array.from({ length: MIN_PROFILE_HISTORY - 1 }, (_, index) => ({
      decision_type: index % 2 === 0 ? "use_now" : "watch",
      outcome: index % 2 === 0 ? "success" : "neutral",
      frame_type: "Frame B",
      genre: "tech",
      threshold_json: {}
    }))
  );

  assert.equal(profile.minimumHistoryMet, false);
  assert.equal(profile.insights.length, 0);
});

test("buildPersonalDecisionHint returns a paid-safe hint only when evidence is sufficient", () => {
  const profile = buildPersonalDecisionProfile(
    Array.from({ length: MIN_SEGMENT_HISTORY }, () => ({
      decision_type: "use_now",
      outcome: "success" as const,
      frame_type: "Frame A",
      genre: "entertainment",
      threshold_json: {
        time_limit: [{ raw: "2時間", value: 2, unit: "hour" }]
      }
    })).concat([
      {
        decision_type: "watch",
        outcome: "neutral",
        frame_type: "Frame B",
        genre: "tech",
        threshold_json: {}
      },
      {
        decision_type: "skip",
        outcome: "regret",
        frame_type: "Frame C",
        genre: "ads",
        threshold_json: {
          ad_time: [{ raw: "12分", value: 12, unit: "minute" }]
        }
      }
    ])
  );

  const hint = buildPersonalDecisionHint({
    profile,
    card: {
      frame_type: "Frame A",
      genre: "entertainment",
      judgment_type: "use_now",
      threshold_json: {
        time_limit: [{ raw: "90分", value: 90, unit: "minute" }]
      }
    }
  });

  assert.equal(hint?.tone, "positive");
  assert.equal(hint?.text.includes("Frame A") || hint?.text.includes("このフレーム"), true);

  const lowSampleHint = buildPersonalDecisionHint({
    profile: buildPersonalDecisionProfile([
      {
        decision_type: "use_now",
        outcome: "success",
        frame_type: "Frame A",
        genre: "entertainment",
        threshold_json: {}
      },
      {
        decision_type: "watch",
        outcome: "neutral",
        frame_type: "Frame A",
        genre: "entertainment",
        threshold_json: {}
      }
    ]),
    card: {
      frame_type: "Frame A",
      genre: "entertainment",
      judgment_type: "use_now",
      threshold_json: {}
    }
  });

  assert.equal(lowSampleHint, null);
});
