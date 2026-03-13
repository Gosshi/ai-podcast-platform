export const INTEREST_TOPIC_OPTIONS = ["games", "streaming", "anime", "movies", "tech"] as const;
export const ACTIVE_SUBSCRIPTION_OPTIONS = [
  "netflix",
  "prime",
  "disney",
  "spotify",
  "youtube",
  "chatgpt",
  "other",
  "none"
] as const;
export const DECISION_PRIORITY_OPTIONS = ["save_money", "save_time", "discover_new", "avoid_regret"] as const;
export const DAILY_AVAILABLE_TIME_OPTIONS = ["under_30m", "30_to_60m", "1_to_2h", "over_2h"] as const;
export const BUDGET_SENSITIVITY_OPTIONS = ["low", "medium", "high"] as const;

export type InterestTopic = (typeof INTEREST_TOPIC_OPTIONS)[number];
export type ActiveSubscription = (typeof ACTIVE_SUBSCRIPTION_OPTIONS)[number];
export type DecisionPriority = (typeof DECISION_PRIORITY_OPTIONS)[number];
export type DailyAvailableTime = (typeof DAILY_AVAILABLE_TIME_OPTIONS)[number];
export type BudgetSensitivity = (typeof BUDGET_SENSITIVITY_OPTIONS)[number];

export type UserPreferences = {
  interestTopics: InterestTopic[];
  activeSubscriptions: ActiveSubscription[];
  decisionPriority: DecisionPriority;
  dailyAvailableTime: DailyAvailableTime;
  budgetSensitivity: BudgetSensitivity | null;
  createdAt?: string;
  updatedAt?: string;
};

export type UserPreferenceProfile = {
  interestTopics: InterestTopic[];
  activeSubscriptions: ActiveSubscription[];
  decisionPriority: DecisionPriority;
  dailyAvailableTime: DailyAvailableTime;
  budgetSensitivity: BudgetSensitivity | null;
  topicAffinities: Record<InterestTopic, number>;
  hasActiveSubscriptions: boolean;
  activeSubscriptionCount: number;
  primaryInterestTopic: InterestTopic | null;
  discoveryMode: boolean;
  moneySensitive: boolean;
  timeSensitive: boolean;
  regretAverse: boolean;
  dailyTimeBudget: "tight" | "steady" | "flexible";
  budgetFlexibility: "flexible" | "balanced" | "strict";
};

export type UserPreferenceSurfaceContext = {
  nextBestDecision: {
    primaryInterestTopic: InterestTopic | null;
    topicAffinities: Record<InterestTopic, number>;
    activeSubscriptions: ActiveSubscription[];
    decisionPriority: DecisionPriority;
    dailyTimeBudget: UserPreferenceProfile["dailyTimeBudget"];
    budgetSensitivity: BudgetSensitivity | null;
  };
  personalHints: {
    primaryInterestTopic: InterestTopic | null;
    discoveryMode: boolean;
    moneySensitive: boolean;
    timeSensitive: boolean;
    regretAverse: boolean;
  };
  watchlistAlerts: {
    activeSubscriptions: ActiveSubscription[];
    regretAverse: boolean;
    timeSensitive: boolean;
    dailyTimeBudget: UserPreferenceProfile["dailyTimeBudget"];
  };
  paywallCopy: {
    decisionPriority: DecisionPriority;
    budgetSensitivity: BudgetSensitivity | null;
    activeSubscriptionCount: number;
    discoveryMode: boolean;
  };
  weeklyDigest: {
    interestTopics: InterestTopic[];
    primaryInterestTopic: InterestTopic | null;
    discoveryMode: boolean;
    dailyTimeBudget: UserPreferenceProfile["dailyTimeBudget"];
  };
};

export const INTEREST_TOPIC_LABELS: Record<InterestTopic, string> = {
  games: "Games",
  streaming: "Streaming",
  anime: "Anime",
  movies: "Movies",
  tech: "Tech"
};

export const ACTIVE_SUBSCRIPTION_LABELS: Record<ActiveSubscription, string> = {
  netflix: "Netflix",
  prime: "Prime Video",
  disney: "Disney+",
  spotify: "Spotify",
  youtube: "YouTube",
  chatgpt: "ChatGPT",
  other: "Other",
  none: "使っていない"
};

export const DECISION_PRIORITY_LABELS: Record<DecisionPriority, string> = {
  save_money: "コストを抑えたい",
  save_time: "時間を無駄にしたくない",
  discover_new: "新しいものを見つけたい",
  avoid_regret: "後悔を避けたい"
};

export const DAILY_AVAILABLE_TIME_LABELS: Record<DailyAvailableTime, string> = {
  under_30m: "30分未満",
  "30_to_60m": "30-60分",
  "1_to_2h": "1-2時間",
  over_2h: "2時間以上"
};

export const BUDGET_SENSITIVITY_LABELS: Record<BudgetSensitivity, string> = {
  low: "低い",
  medium: "中くらい",
  high: "高い"
};

const DAILY_AVAILABLE_TIME_ALIASES: Record<string, DailyAvailableTime> = {
  "<30min": "under_30m",
  "30-60": "30_to_60m",
  "1-2h": "1_to_2h",
  "2h+": "over_2h"
};

const toOrderedSelection = <T extends string>(value: unknown, allowed: readonly T[], noneValue?: T): T[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  const received = new Set(
    value
      .filter((entry): entry is string => typeof entry === "string")
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0)
  );

  const ordered = allowed.filter((entry) => received.has(entry));
  if (noneValue && ordered.includes(noneValue) && ordered.length > 1) {
    return ordered.filter((entry) => entry !== noneValue);
  }

  return ordered;
};

const toEnumValue = <T extends string>(
  value: unknown,
  allowed: readonly T[],
  aliases?: Record<string, T>
): T | null => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  const normalized = aliases?.[trimmed] ?? trimmed;
  return allowed.includes(normalized as T) ? (normalized as T) : null;
};

const toOptionalEnumValue = <T extends string>(
  value: unknown,
  allowed: readonly T[],
  aliases?: Record<string, T>
): T | null | undefined => {
  if (value === null || value === undefined) {
    return undefined;
  }

  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return undefined;
  }

  const normalized = aliases?.[trimmed] ?? trimmed;
  return allowed.includes(normalized as T) ? (normalized as T) : null;
};

export const validateUserPreferencesInput = (input: {
  interestTopics?: unknown;
  activeSubscriptions?: unknown;
  decisionPriority?: unknown;
  dailyAvailableTime?: unknown;
  budgetSensitivity?: unknown;
}): { ok: true; value: Omit<UserPreferences, "createdAt" | "updatedAt"> } | { ok: false; error: string } => {
  const interestTopics = toOrderedSelection(input.interestTopics, INTEREST_TOPIC_OPTIONS);
  if (interestTopics.length === 0) {
    return {
      ok: false,
      error: "interest_topics_required"
    };
  }

  const activeSubscriptions = toOrderedSelection(input.activeSubscriptions, ACTIVE_SUBSCRIPTION_OPTIONS, "none");
  if (activeSubscriptions.length === 0) {
    return {
      ok: false,
      error: "active_subscriptions_required"
    };
  }

  const decisionPriority = toEnumValue(input.decisionPriority, DECISION_PRIORITY_OPTIONS);
  if (!decisionPriority) {
    return {
      ok: false,
      error: "decision_priority_required"
    };
  }

  const dailyAvailableTime = toEnumValue(
    input.dailyAvailableTime,
    DAILY_AVAILABLE_TIME_OPTIONS,
    DAILY_AVAILABLE_TIME_ALIASES
  );
  if (!dailyAvailableTime) {
    return {
      ok: false,
      error: "daily_available_time_required"
    };
  }

  const budgetSensitivity = toOptionalEnumValue(input.budgetSensitivity, BUDGET_SENSITIVITY_OPTIONS);
  if (budgetSensitivity === null) {
    return {
      ok: false,
      error: "budget_sensitivity_invalid"
    };
  }

  return {
    ok: true,
    value: {
      interestTopics,
      activeSubscriptions,
      decisionPriority,
      dailyAvailableTime,
      budgetSensitivity: budgetSensitivity ?? null
    }
  };
};

export const initializeUserPreferenceProfile = (preferences: UserPreferences): UserPreferenceProfile => {
  const topicAffinities = INTEREST_TOPIC_OPTIONS.reduce(
    (accumulator, topic) => {
      accumulator[topic] = preferences.interestTopics.includes(topic) ? 1 : 0;
      return accumulator;
    },
    {} as Record<InterestTopic, number>
  );

  const activeSubscriptions = preferences.activeSubscriptions.filter(
    (subscription): subscription is Exclude<ActiveSubscription, "none"> => subscription !== "none"
  );
  const budgetFlexibility =
    preferences.budgetSensitivity === "high"
      ? "strict"
      : preferences.budgetSensitivity === "low"
        ? "flexible"
        : "balanced";

  return {
    interestTopics: preferences.interestTopics,
    activeSubscriptions: preferences.activeSubscriptions,
    decisionPriority: preferences.decisionPriority,
    dailyAvailableTime: preferences.dailyAvailableTime,
    budgetSensitivity: preferences.budgetSensitivity,
    topicAffinities,
    hasActiveSubscriptions: activeSubscriptions.length > 0,
    activeSubscriptionCount: activeSubscriptions.length,
    primaryInterestTopic: preferences.interestTopics[0] ?? null,
    discoveryMode: preferences.decisionPriority === "discover_new",
    moneySensitive: preferences.decisionPriority === "save_money" || preferences.budgetSensitivity === "high",
    timeSensitive: preferences.decisionPriority === "save_time",
    regretAverse: preferences.decisionPriority === "avoid_regret",
    dailyTimeBudget:
      preferences.dailyAvailableTime === "under_30m"
        ? "tight"
        : preferences.dailyAvailableTime === "over_2h"
          ? "flexible"
          : "steady",
    budgetFlexibility
  };
};

// Explicit onboarding preferences are kept separate from history-derived profile
// so multiple product surfaces can consume the same cold-start signals.
export const buildUserPreferenceSurfaceContext = (
  profile: UserPreferenceProfile | null | undefined
): UserPreferenceSurfaceContext | null => {
  if (!profile) {
    return null;
  }

  return {
    nextBestDecision: {
      primaryInterestTopic: profile.primaryInterestTopic,
      topicAffinities: profile.topicAffinities,
      activeSubscriptions: profile.activeSubscriptions,
      decisionPriority: profile.decisionPriority,
      dailyTimeBudget: profile.dailyTimeBudget,
      budgetSensitivity: profile.budgetSensitivity
    },
    personalHints: {
      primaryInterestTopic: profile.primaryInterestTopic,
      discoveryMode: profile.discoveryMode,
      moneySensitive: profile.moneySensitive,
      timeSensitive: profile.timeSensitive,
      regretAverse: profile.regretAverse
    },
    watchlistAlerts: {
      activeSubscriptions: profile.activeSubscriptions,
      regretAverse: profile.regretAverse,
      timeSensitive: profile.timeSensitive,
      dailyTimeBudget: profile.dailyTimeBudget
    },
    paywallCopy: {
      decisionPriority: profile.decisionPriority,
      budgetSensitivity: profile.budgetSensitivity,
      activeSubscriptionCount: profile.activeSubscriptionCount,
      discoveryMode: profile.discoveryMode
    },
    weeklyDigest: {
      interestTopics: profile.interestTopics,
      primaryInterestTopic: profile.primaryInterestTopic,
      discoveryMode: profile.discoveryMode,
      dailyTimeBudget: profile.dailyTimeBudget
    }
  };
};
