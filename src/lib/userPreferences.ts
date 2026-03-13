export const INTEREST_TOPIC_OPTIONS = ["games", "streaming", "anime", "movies", "tech"] as const;
export const ACTIVE_SUBSCRIPTION_OPTIONS = ["netflix", "prime", "disney", "spotify", "youtube", "none"] as const;
export const DECISION_PRIORITY_OPTIONS = ["save_money", "save_time", "discover_new", "avoid_regret"] as const;
export const DAILY_AVAILABLE_TIME_OPTIONS = ["<30min", "30-60", "1-2h", "2h+"] as const;

export type InterestTopic = (typeof INTEREST_TOPIC_OPTIONS)[number];
export type ActiveSubscription = (typeof ACTIVE_SUBSCRIPTION_OPTIONS)[number];
export type DecisionPriority = (typeof DECISION_PRIORITY_OPTIONS)[number];
export type DailyAvailableTime = (typeof DAILY_AVAILABLE_TIME_OPTIONS)[number];

export type UserPreferences = {
  interestTopics: InterestTopic[];
  activeSubscriptions: ActiveSubscription[];
  decisionPriority: DecisionPriority;
  dailyAvailableTime: DailyAvailableTime;
  createdAt?: string;
  updatedAt?: string;
};

export type UserPreferenceProfile = {
  interestTopics: InterestTopic[];
  activeSubscriptions: ActiveSubscription[];
  decisionPriority: DecisionPriority;
  dailyAvailableTime: DailyAvailableTime;
  topicAffinities: Record<InterestTopic, number>;
  hasActiveSubscriptions: boolean;
  primaryInterestTopic: InterestTopic | null;
  discoveryMode: boolean;
  moneySensitive: boolean;
  timeSensitive: boolean;
  regretAverse: boolean;
  dailyTimeBudget: "tight" | "steady" | "flexible";
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
  youtube: "YouTube Premium",
  none: "使っていない"
};

export const DECISION_PRIORITY_LABELS: Record<DecisionPriority, string> = {
  save_money: "コストを抑えたい",
  save_time: "時間を無駄にしたくない",
  discover_new: "新しいものを見つけたい",
  avoid_regret: "後悔を避けたい"
};

export const DAILY_AVAILABLE_TIME_LABELS: Record<DailyAvailableTime, string> = {
  "<30min": "30分未満",
  "30-60": "30-60分",
  "1-2h": "1-2時間",
  "2h+": "2時間以上"
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

const toEnumValue = <T extends string>(value: unknown, allowed: readonly T[]): T | null => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return allowed.includes(trimmed as T) ? (trimmed as T) : null;
};

export const validateUserPreferencesInput = (input: {
  interestTopics?: unknown;
  activeSubscriptions?: unknown;
  decisionPriority?: unknown;
  dailyAvailableTime?: unknown;
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

  const dailyAvailableTime = toEnumValue(input.dailyAvailableTime, DAILY_AVAILABLE_TIME_OPTIONS);
  if (!dailyAvailableTime) {
    return {
      ok: false,
      error: "daily_available_time_required"
    };
  }

  return {
    ok: true,
    value: {
      interestTopics,
      activeSubscriptions,
      decisionPriority,
      dailyAvailableTime
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

  return {
    interestTopics: preferences.interestTopics,
    activeSubscriptions: preferences.activeSubscriptions,
    decisionPriority: preferences.decisionPriority,
    dailyAvailableTime: preferences.dailyAvailableTime,
    topicAffinities,
    hasActiveSubscriptions: activeSubscriptions.length > 0,
    primaryInterestTopic: preferences.interestTopics[0] ?? null,
    discoveryMode: preferences.decisionPriority === "discover_new",
    moneySensitive: preferences.decisionPriority === "save_money",
    timeSensitive: preferences.decisionPriority === "save_time",
    regretAverse: preferences.decisionPriority === "avoid_regret",
    dailyTimeBudget:
      preferences.dailyAvailableTime === "<30min"
        ? "tight"
        : preferences.dailyAvailableTime === "2h+"
          ? "flexible"
          : "steady"
  };
};
