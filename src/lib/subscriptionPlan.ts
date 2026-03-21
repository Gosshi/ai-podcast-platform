const DEFAULT_MONTHLY_PRICE_YEN = 780;
const DEFAULT_TRIAL_DAYS = 7;

const parsePositiveInteger = (value: string | undefined): number | null => {
  if (!value) return null;
  const parsed = Number.parseInt(value.trim(), 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }
  return parsed;
};

export const MONTHLY_PRICE_YEN = DEFAULT_MONTHLY_PRICE_YEN;

export const resolveSubscriptionTrialDays = (): number => {
  return parsePositiveInteger(process.env.STRIPE_SUBSCRIPTION_TRIAL_DAYS) ?? DEFAULT_TRIAL_DAYS;
};

export const hasSubscriptionTrial = (): boolean => {
  return resolveSubscriptionTrialDays() > 0;
};

export const resolveSubscriptionTrialLabel = (): string | null => {
  const days = resolveSubscriptionTrialDays();
  if (days <= 0) {
    return null;
  }

  return `${days}日間無料で試す`;
};

export const resolveSubscriptionPaymentTimingText = (): string => {
  const days = resolveSubscriptionTrialDays();
  if (days <= 0) {
    return "申込時に初回課金され、以降は契約更新日に自動課金されます。";
  }

  return `無料トライアル終了後に初回課金され、以降は契約更新日に自動課金されます。トライアル期間は申込日から${days}日間です。`;
};
