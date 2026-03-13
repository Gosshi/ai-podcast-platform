import assert from "node:assert/strict";
import test from "node:test";
import { buildPersonalDecisionProfile } from "../src/lib/decisionProfile.ts";
import { rankNextBestDecisions } from "../src/lib/nextBestDecision.ts";
import { initializeUserPreferenceProfile } from "../src/lib/userPreferences.ts";

const NOW = new Date("2026-03-13T00:00:00.000Z");

test("rankNextBestDecisions prioritizes near deadlines ahead of non-urgent cards", () => {
  const recommendations = rankNextBestDecisions({
    isPaid: false,
    now: NOW,
    limit: 2,
    cards: [
      {
        id: "watch-deadline",
        episode_id: "ep-1",
        topic_title: "Trial expires tomorrow",
        judgment_type: "watch",
        judgment_summary: "期限付きで比較を続ける。",
        action_text: null,
        deadline_at: null,
        ranking_deadline_at: "2026-03-13T12:00:00.000Z",
        threshold_json: {},
        frame_type: "Frame B",
        genre: "entertainment",
        created_at: "2026-03-12T12:00:00.000Z",
        confidence_score: 0.8
      },
      {
        id: "use-now",
        episode_id: "ep-2",
        topic_title: "Useful but no deadline",
        judgment_type: "use_now",
        judgment_summary: "今日から使える。",
        action_text: null,
        deadline_at: null,
        ranking_deadline_at: null,
        threshold_json: {},
        frame_type: "Frame A",
        genre: "tech",
        created_at: "2026-03-12T12:00:00.000Z",
        confidence_score: 0.8
      }
    ]
  });

  assert.equal(recommendations[0]?.card.id, "watch-deadline");
  assert.equal(recommendations[0]?.reason_tags.includes("締切が近い"), true);
  assert.equal(recommendations[0]?.deadline_label, "24時間以内に確認");
});

test("rankNextBestDecisions adds paid-only personal reasons from the decision profile", () => {
  const profile = buildPersonalDecisionProfile([
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
      decision_type: "watch",
      outcome: "regret",
      frame_type: "Frame C",
      genre: "ads",
      threshold_json: {
        ad_time: [{ raw: "10分", value: 10, unit: "minute" }]
      }
    },
    {
      decision_type: "skip",
      outcome: "regret",
      frame_type: "Frame C",
      genre: "ads",
      threshold_json: {
        ad_time: [{ raw: "12分", value: 12, unit: "minute" }]
      }
    },
    {
      decision_type: "use_now",
      outcome: "success",
      frame_type: "Frame A",
      genre: "tech",
      threshold_json: {
        time_limit: [{ raw: "2時間", value: 2, unit: "hour" }]
      }
    },
    {
      decision_type: "use_now",
      outcome: "success",
      frame_type: "Frame A",
      genre: "tech",
      threshold_json: {
        time_limit: [{ raw: "90分", value: 90, unit: "minute" }]
      }
    }
  ]);

  const personalizedCard = {
    id: "personalized-watch",
    episode_id: "ep-1",
    topic_title: "Ad-heavy bundle",
    judgment_type: "watch" as const,
    judgment_summary: "広告時間を見て再判断する。",
    action_text: null,
    deadline_at: null,
    ranking_deadline_at: "2026-03-16T00:00:00.000Z",
    threshold_json: {
      ad_time: [{ raw: "15分", value: 15, unit: "minute" }]
    },
    frame_type: "Frame C",
    genre: "ads",
    created_at: "2026-03-12T10:00:00.000Z",
    confidence_score: 0.7
  };

  const freeRecommendation = rankNextBestDecisions({
    cards: [personalizedCard],
    isPaid: false,
    now: NOW,
    limit: 1
  })[0];
  const paidRecommendation = rankNextBestDecisions({
    cards: [personalizedCard],
    isPaid: true,
    profile,
    now: NOW,
    limit: 1
  })[0];

  assert.equal(freeRecommendation.reason_tags.includes("あなた向け"), false);
  assert.equal(paidRecommendation.reason_tags.includes("あなた向け"), true);
  assert.equal(paidRecommendation.reason_tags.includes("後悔防止"), true);
  assert.equal(
    paidRecommendation.reason_tags.some((tag) => tag === "あなたはこのタイプで後悔しやすい" || tag === "後悔しやすい条件に近い"),
    true
  );
  assert.equal(paidRecommendation.priority_score > freeRecommendation.priority_score, true);
});

test("rankNextBestDecisions suppresses personal reasons when the profile is insufficient", () => {
  const shallowProfile = buildPersonalDecisionProfile([
    {
      decision_type: "use_now",
      outcome: "success",
      frame_type: "Frame A",
      genre: "tech",
      threshold_json: {}
    },
    {
      decision_type: "watch",
      outcome: "neutral",
      frame_type: "Frame A",
      genre: "tech",
      threshold_json: {}
    }
  ]);

  const recommendation = rankNextBestDecisions({
    isPaid: true,
    profile: shallowProfile,
    now: NOW,
    limit: 1,
    cards: [
      {
        id: "insufficient-profile",
        episode_id: "ep-3",
        topic_title: "New release",
        judgment_type: "use_now",
        judgment_summary: "すぐ使える候補。",
        action_text: null,
        deadline_at: null,
        ranking_deadline_at: null,
        threshold_json: {},
        frame_type: "Frame A",
        genre: "tech",
        created_at: "2026-03-12T12:00:00.000Z",
        confidence_score: 0.6
      }
    ]
  })[0];

  assert.equal(recommendation.reason_tags.includes("あなた向け"), false);
  assert.equal(recommendation.reason_tags.includes("今すぐ使える"), true);
});

test("rankNextBestDecisions keeps preference profile context without changing scores", () => {
  const preferenceProfile = initializeUserPreferenceProfile({
    interestTopics: ["games", "tech"],
    activeSubscriptions: ["netflix", "spotify", "chatgpt"],
    decisionPriority: "avoid_regret",
    dailyAvailableTime: "under_30m",
    budgetSensitivity: "medium"
  });

  const recommendation = rankNextBestDecisions({
    isPaid: false,
    preferenceProfile,
    now: NOW,
    limit: 1,
    cards: [
      {
        id: "preference-context",
        episode_id: "ep-5",
        topic_title: "New sci-fi release",
        judgment_type: "watch",
        judgment_summary: "公開直後なので様子を見る。",
        action_text: null,
        deadline_at: null,
        ranking_deadline_at: null,
        threshold_json: {},
        frame_type: "Frame B",
        genre: "streaming",
        created_at: "2026-03-12T12:00:00.000Z",
        confidence_score: 0.4
      }
    ]
  })[0];

  assert.equal(recommendation.personalization_context.hasHistoryProfile, false);
  assert.equal(recommendation.personalization_context.preferenceProfile?.decisionPriority, "avoid_regret");
  assert.equal(recommendation.personalization_context.preferenceProfile?.dailyTimeBudget, "tight");
});

test("rankNextBestDecisions falls back cleanly when cards have no deadlines", () => {
  const recommendation = rankNextBestDecisions({
    isPaid: false,
    now: NOW,
    limit: 1,
    cards: [
      {
        id: "no-deadline",
        episode_id: "ep-4",
        topic_title: "Optional tool",
        judgment_type: "skip",
        judgment_summary: "今回は見送る。",
        action_text: null,
        deadline_at: null,
        ranking_deadline_at: null,
        threshold_json: {},
        frame_type: null,
        genre: null,
        created_at: "2026-03-12T12:00:00.000Z",
        confidence_score: 0.1
      }
    ]
  })[0];

  assert.equal(recommendation.deadline_label, "期限未設定");
  assert.equal(recommendation.recommended_action, "今回は見送り、他の候補を優先する");
  assert.equal(recommendation.urgency_level, "low");
});
