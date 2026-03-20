const DEFAULT_STRIPE_TRIAL_DAYS = 7;
const MAX_STRIPE_TRIAL_DAYS = 30;

const TRIAL_CONSUMED_STATUSES = new Set([
  "trialing",
  "active",
  "past_due",
  "canceled",
  "unpaid",
  "paused"
]);

export const resolveStripeTrialDays = (rawValue = process.env.STRIPE_TRIAL_DAYS): number => {
  if (rawValue === undefined) {
    return DEFAULT_STRIPE_TRIAL_DAYS;
  }

  const trimmed = rawValue.trim();
  if (!trimmed) {
    return DEFAULT_STRIPE_TRIAL_DAYS;
  }

  const parsed = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_STRIPE_TRIAL_DAYS;
  }

  return Math.min(MAX_STRIPE_TRIAL_DAYS, Math.max(0, parsed));
};

export const hasConsumedStripeTrial = (status: string | null | undefined): boolean => {
  if (!status) return false;
  return TRIAL_CONSUMED_STATUSES.has(status);
};

export const getStripeTrialConsumedStatuses = (): string[] => {
  return Array.from(TRIAL_CONSUMED_STATUSES);
};
