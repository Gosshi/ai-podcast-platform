import assert from "node:assert/strict";
import test from "node:test";
import {
  buildUserAlertCandidates,
  buildWeeklyDigestAlertSourceId,
  type UserNotificationPreferences
} from "../src/lib/alerts.ts";

const NOW = new Date("2026-03-13T09:00:00.000Z");

const ENABLED_PREFERENCES: UserNotificationPreferences = {
  weeklyDigestEnabled: true,
  deadlineAlertEnabled: true,
  outcomeReminderEnabled: true
};

test("buildUserAlertCandidates returns all alert families for paid users", () => {
  const alerts = buildUserAlertCandidates({
    userId: "user-1",
    isPaid: true,
    now: NOW,
    notificationPreferences: ENABLED_PREFERENCES,
    judgmentCards: [
      {
        id: "card-1",
        episode_id: "episode-1",
        topic_title: "クーポンを使うか",
        judgment_type: "use_now",
        deadline_at: "2026-03-14T00:00:00.000Z",
        created_at: "2026-03-13T00:00:00.000Z"
      },
      {
        id: "card-2",
        episode_id: "episode-2",
        topic_title: "配信を解約するか",
        judgment_type: "watch",
        deadline_at: "2026-03-15T00:00:00.000Z",
        created_at: "2026-03-12T00:00:00.000Z"
      }
    ],
    outcomeDecisions: [
      {
        id: "decision-1",
        judgment_card_id: "card-3",
        episode_id: "episode-3",
        topic_title: "ゲームを継続するか",
        frame_type: "Frame A",
        genre: "games",
        decision_type: "watch",
        outcome: null,
        created_at: "2026-03-09T00:00:00.000Z",
        deadline_at: null
      }
    ],
    watchlistItems: [
      {
        id: "watchlist-1",
        judgment_card_id: "card-4",
        episode_id: "episode-4",
        topic_title: "映画サブスクを見直すか",
        deadline_at: "2026-03-14T18:00:00.000Z",
        created_at: "2026-03-10T00:00:00.000Z",
        history_decision_id: null,
        status: "watching"
      }
    ],
    weeklyDigest: {
      windowStart: "2026-03-06T00:00:00.000Z",
      windowEnd: "2026-03-13T00:00:00.000Z",
      counts: {
        use_now: 2,
        watch: 3,
        skip: 1
      },
      previewLimited: false
    }
  });

  assert.equal(alerts.length, 5);
  assert.equal(alerts.some((alert) => alert.alert_type === "deadline_due_soon"), true);
  assert.equal(alerts.some((alert) => alert.alert_type === "watchlist_due_soon"), true);
  assert.equal(alerts.some((alert) => alert.alert_type === "outcome_reminder"), true);
  assert.equal(alerts.some((alert) => alert.alert_type === "weekly_digest_ready"), true);
  assert.equal(
    alerts.find((alert) => alert.alert_type === "weekly_digest_ready")?.source_id,
    buildWeeklyDigestAlertSourceId("2026-03-06T00:00:00.000Z", "2026-03-13T00:00:00.000Z")
  );
});

test("buildUserAlertCandidates caps free users to preview-sized alerts", () => {
  const alerts = buildUserAlertCandidates({
    userId: "user-1",
    isPaid: false,
    now: NOW,
    notificationPreferences: ENABLED_PREFERENCES,
    judgmentCards: [
      {
        id: "card-1",
        episode_id: "episode-1",
        topic_title: "クーポンを使うか",
        judgment_type: "use_now",
        deadline_at: "2026-03-13T18:00:00.000Z",
        created_at: "2026-03-13T00:00:00.000Z"
      },
      {
        id: "card-2",
        episode_id: "episode-2",
        topic_title: "新作を見るか",
        judgment_type: "watch",
        deadline_at: "2026-03-14T00:00:00.000Z",
        created_at: "2026-03-12T00:00:00.000Z"
      }
    ],
    outcomeDecisions: [
      {
        id: "decision-1",
        judgment_card_id: "card-3",
        episode_id: "episode-3",
        topic_title: "ツールを継続するか",
        frame_type: "Frame A",
        genre: "tech",
        decision_type: "watch",
        outcome: null,
        created_at: "2026-03-09T00:00:00.000Z",
        deadline_at: null
      },
      {
        id: "decision-2",
        judgment_card_id: "card-4",
        episode_id: "episode-4",
        topic_title: "既にもう一件",
        frame_type: "Frame B",
        genre: "tech",
        decision_type: "use_now",
        outcome: null,
        created_at: "2026-03-08T00:00:00.000Z",
        deadline_at: null
      }
    ],
    watchlistItems: [
      {
        id: "watchlist-1",
        judgment_card_id: "card-5",
        episode_id: "episode-5",
        topic_title: "映画サブスクを見直すか",
        deadline_at: "2026-03-14T18:00:00.000Z",
        created_at: "2026-03-10T00:00:00.000Z",
        history_decision_id: null,
        status: "watching"
      }
    ],
    weeklyDigest: {
      windowStart: "2026-03-06T00:00:00.000Z",
      windowEnd: "2026-03-13T00:00:00.000Z",
      counts: {
        use_now: 1,
        watch: 1,
        skip: 1
      },
      previewLimited: true
    }
  });

  assert.equal(alerts.length, 4);
  assert.deepEqual(
    alerts.map((alert) => alert.alert_type).sort(),
    ["deadline_due_soon", "outcome_reminder", "watchlist_due_soon", "weekly_digest_ready"].sort()
  );
  assert.equal(alerts.find((alert) => alert.alert_type === "weekly_digest_ready")?.metadata.preview_limited, true);
});

test("buildUserAlertCandidates respects notification preferences", () => {
  const alerts = buildUserAlertCandidates({
    userId: "user-1",
    isPaid: true,
    now: NOW,
    notificationPreferences: {
      weeklyDigestEnabled: false,
      deadlineAlertEnabled: false,
      outcomeReminderEnabled: true
    },
    judgmentCards: [
      {
        id: "card-1",
        episode_id: "episode-1",
        topic_title: "クーポンを使うか",
        judgment_type: "use_now",
        deadline_at: "2026-03-13T18:00:00.000Z",
        created_at: "2026-03-13T00:00:00.000Z"
      }
    ],
    outcomeDecisions: [
      {
        id: "decision-1",
        judgment_card_id: "card-3",
        episode_id: "episode-3",
        topic_title: "ツールを継続するか",
        frame_type: "Frame A",
        genre: "tech",
        decision_type: "watch",
        outcome: null,
        created_at: "2026-03-09T00:00:00.000Z",
        deadline_at: null
      }
    ],
    watchlistItems: [],
    weeklyDigest: {
      windowStart: "2026-03-06T00:00:00.000Z",
      windowEnd: "2026-03-13T00:00:00.000Z",
      counts: {
        use_now: 1,
        watch: 1,
        skip: 1
      },
      previewLimited: false
    }
  });

  assert.equal(alerts.length, 1);
  assert.equal(alerts[0]?.alert_type, "outcome_reminder");
});
