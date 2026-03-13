import assert from "node:assert/strict";
import test from "node:test";
import {
  FREE_OUTCOME_REMINDER_LIMIT,
  buildOutcomeReminderCandidates,
  formatOutcomeReminderTiming,
  limitOutcomeReminderCandidates
} from "../src/lib/outcomeReminder.ts";

const NOW = new Date("2026-03-13T09:00:00.000Z");

test("buildOutcomeReminderCandidates returns only unresolved decisions that passed deadline or age threshold", () => {
  const reminders = buildOutcomeReminderCandidates(
    [
      {
        id: "decision-1",
        judgment_card_id: "card-1",
        episode_id: "episode-1",
        topic_title: "月額ツールを継続するか",
        frame_type: "Frame A",
        genre: "productivity",
        decision_type: "watch",
        outcome: null,
        created_at: "2026-03-09T00:00:00.000Z",
        deadline_at: null
      },
      {
        id: "decision-2",
        judgment_card_id: "card-2",
        episode_id: "episode-2",
        topic_title: "クーポンを今使うか",
        frame_type: "Frame B",
        genre: "shopping",
        decision_type: "use_now",
        outcome: null,
        created_at: "2026-03-12T00:00:00.000Z",
        deadline_at: "2026-03-12T06:00:00.000Z"
      },
      {
        id: "decision-3",
        judgment_card_id: "card-3",
        episode_id: "episode-3",
        topic_title: "まだ保存直後",
        frame_type: null,
        genre: null,
        decision_type: "skip",
        outcome: null,
        created_at: "2026-03-12T12:00:00.000Z",
        deadline_at: null
      },
      {
        id: "decision-4",
        judgment_card_id: "card-4",
        episode_id: "episode-4",
        topic_title: "既に結果あり",
        frame_type: null,
        genre: null,
        decision_type: "use_now",
        outcome: "success",
        created_at: "2026-03-09T00:00:00.000Z",
        deadline_at: null
      }
    ],
    {
      now: NOW
    }
  );

  assert.deepEqual(
    reminders.map((reminder) => [reminder.id, reminder.reason]),
    [
      ["decision-2", "deadline_passed"],
      ["decision-1", "elapsed_days"]
    ]
  );
  assert.equal(reminders[0]?.days_past_deadline, 1);
  assert.equal(formatOutcomeReminderTiming(reminders[0]!), "期限から1日経過");
  assert.equal(formatOutcomeReminderTiming(reminders[1]!), "保存から4日経過");
});

test("limitOutcomeReminderCandidates keeps free plan capped and paid plan unlimited", () => {
  const reminders = buildOutcomeReminderCandidates(
    Array.from({ length: 5 }, (_, index) => ({
      id: `decision-${index + 1}`,
      judgment_card_id: `card-${index + 1}`,
      episode_id: `episode-${index + 1}`,
      topic_title: `topic-${index + 1}`,
      frame_type: null,
      genre: null,
      decision_type: index % 2 === 0 ? "use_now" : "watch",
      outcome: null,
      created_at: "2026-03-09T00:00:00.000Z",
      deadline_at: null
    })),
    {
      now: NOW
    }
  );

  assert.equal(limitOutcomeReminderCandidates(reminders, false).length, FREE_OUTCOME_REMINDER_LIMIT);
  assert.equal(limitOutcomeReminderCandidates(reminders, true).length, reminders.length);
});
