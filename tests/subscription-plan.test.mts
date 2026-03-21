import test from "node:test";
import assert from "node:assert/strict";

const loadModule = async () => {
  return import(`../src/lib/subscriptionPlan.ts?ts=${Date.now()}`);
};

test("subscription plan defaults to a 7-day trial", async () => {
  delete process.env.STRIPE_SUBSCRIPTION_TRIAL_DAYS;

  const { resolveSubscriptionTrialDays, resolveSubscriptionTrialLabel, resolveSubscriptionPaymentTimingText } =
    await loadModule();

  assert.equal(resolveSubscriptionTrialDays(), 7);
  assert.equal(resolveSubscriptionTrialLabel(), "7日間無料で試す");
  assert.match(resolveSubscriptionPaymentTimingText(), /トライアル期間は申込日から7日間/);
});

test("subscription plan can disable trial via env", async () => {
  process.env.STRIPE_SUBSCRIPTION_TRIAL_DAYS = "0";

  const { hasSubscriptionTrial, resolveSubscriptionTrialLabel, resolveSubscriptionPaymentTimingText } =
    await loadModule();

  assert.equal(hasSubscriptionTrial(), false);
  assert.equal(resolveSubscriptionTrialLabel(), null);
  assert.match(resolveSubscriptionPaymentTimingText(), /申込時に初回課金/);
});
