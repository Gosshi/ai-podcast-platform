import test from "node:test";
import assert from "node:assert/strict";
import {
  formatMembershipDate,
  resolveMembershipBadgeLabel,
  resolveMembershipStatusLabel,
  resolvePaymentStateLabel,
  resolvePlanName
} from "../app/lib/membership.ts";

test("membership helpers describe free viewer defaults", () => {
  assert.equal(resolvePlanName(null, false), "Free");
  assert.equal(resolveMembershipBadgeLabel(false), "FREE");
  assert.equal(resolveMembershipStatusLabel(null, false), "無料プラン");
  assert.equal(resolvePaymentStateLabel(null), "未登録");
});

test("membership helpers describe paid subscription states", () => {
  assert.equal(resolvePlanName("pro_monthly", true), "Pro Monthly");
  assert.equal(resolveMembershipBadgeLabel(true), "PAID");
  assert.equal(resolveMembershipStatusLabel("active", false), "利用中");
  assert.equal(resolveMembershipStatusLabel("active", true), "期間終了で解約予定");
  assert.equal(resolvePaymentStateLabel("past_due"), "更新が必要");
});

test("formatMembershipDate returns localized date for valid inputs", () => {
  assert.equal(
    formatMembershipDate("2026-03-20T00:00:00.000Z", "ja-JP", {
      year: "numeric",
      month: "long",
      day: "numeric"
    }),
    "2026年3月20日"
  );
  assert.equal(formatMembershipDate(null), "-");
});
