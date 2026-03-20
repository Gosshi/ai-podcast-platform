import assert from "node:assert/strict";
import test from "node:test";

const accountSecurity = await import("../app/lib/accountSecurityNotifications.ts");

test("shouldSendLoginNotification when sign-in is newer than last notified", () => {
  assert.equal(accountSecurity.shouldSendLoginNotification(null, "2026-03-21T10:00:00.000Z"), true);
  assert.equal(
    accountSecurity.shouldSendLoginNotification("2026-03-21T09:00:00.000Z", "2026-03-21T10:00:00.000Z"),
    true
  );
  assert.equal(
    accountSecurity.shouldSendLoginNotification("2026-03-21T10:00:00.000Z", "2026-03-21T10:00:00.000Z"),
    false
  );
});

test("describeUserPreferencesChanges returns only changed fields", () => {
  const before = {
    interestTopics: ["games", "tech"],
    activeSubscriptions: ["netflix", "chatgpt"],
    decisionPriority: "save_money",
    dailyAvailableTime: "under_30m",
    budgetSensitivity: "high"
  } as const;

  const after = {
    interestTopics: ["games", "anime"],
    activeSubscriptions: ["netflix", "chatgpt"],
    decisionPriority: "discover_new",
    dailyAvailableTime: "30_to_60m",
    budgetSensitivity: "medium"
  } as const;

  const changes = accountSecurity.describeUserPreferencesChanges(before, after);

  assert.equal(changes.length, 4);
  assert.equal(changes.some((line: string) => line.startsWith("興味ジャンル:")), true);
  assert.equal(changes.some((line: string) => line.startsWith("重視すること:")), true);
  assert.equal(changes.some((line: string) => line.startsWith("使える時間:")), true);
  assert.equal(changes.some((line: string) => line.startsWith("予算感度:")), true);
});

test("describeNotificationPreferenceChanges returns toggled notification settings", () => {
  const changes = accountSecurity.describeNotificationPreferenceChanges(
    {
      weeklyDigestEnabled: true,
      deadlineAlertEnabled: true,
      outcomeReminderEnabled: false
    },
    {
      weeklyDigestEnabled: false,
      deadlineAlertEnabled: true,
      outcomeReminderEnabled: true
    }
  );

  assert.deepEqual(changes, [
    "週ごとのまとめ: 有効 → 無効",
    "結果の記録リマインド: 無効 → 有効"
  ]);
});
