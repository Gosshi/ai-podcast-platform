import type { JudgmentThresholdJson, JudgmentType } from "./judgmentCards";
import type { ActiveSubscription, DecisionPriority, InterestTopic, UserPreferenceProfile } from "./userPreferences";

export const DECISION_LIBRARY_SORTS = [
  "newest",
  "deadline_soon",
  "judgment_priority"
] as const;

export type DecisionLibrarySort = (typeof DECISION_LIBRARY_SORTS)[number];

export const DECISION_LIBRARY_URGENCIES = [
  "overdue",
  "due_soon",
  "no_deadline"
] as const;

export type DecisionLibraryUrgency = (typeof DECISION_LIBRARY_URGENCIES)[number];

export type DecisionLibraryCardRecord = {
  topic_title: string;
  judgment_summary: string;
  judgment_type: JudgmentType;
  frame_type: string | null;
  genre: string | null;
  deadline_at: string | null;
  created_at: string;
  episode_published_at?: string | null;
};

export type GateableDecisionLibraryCard = {
  action_text: string | null;
  deadline_at: string | null;
  threshold_json: JudgmentThresholdJson;
  watch_points: string[];
  urgency: DecisionLibraryUrgency;
};

export type DecisionLibraryFilters = {
  query: string;
  genre: string | null;
  frameType: string | null;
  judgmentType: JudgmentType | null;
  urgency: DecisionLibraryUrgency | null;
  sort: DecisionLibrarySort;
};

export type DecisionLibraryPersonalizationSummary = {
  defaultSort: DecisionLibrarySort;
  interestTopics: InterestTopic[];
  activeSubscriptions: ActiveSubscription[];
  decisionPriority: DecisionPriority;
};

export type DecisionLibraryPersonalizationSignals = {
  score: number;
  reasons: string[];
  matchedInterestTopics: InterestTopic[];
  matchedSubscriptions: ActiveSubscription[];
};

const JUDGMENT_PRIORITY: Record<JudgmentType, number> = {
  use_now: 0,
  watch: 1,
  skip: 2
};

const INTEREST_TOPIC_GENRE_ALIASES: Record<InterestTopic, string[]> = {
  games: ["games", "gaming", "entertainment"],
  streaming: ["streaming", "entertainment"],
  anime: ["anime", "entertainment"],
  movies: ["movies", "movie", "entertainment"],
  tech: ["tech", "technology"]
};

const INTEREST_TOPIC_REASON_LABELS: Record<InterestTopic, string> = {
  games: "Games interest",
  streaming: "Streaming interest",
  anime: "Anime interest",
  movies: "Movies interest",
  tech: "Tech interest"
};

const ACTIVE_SUBSCRIPTION_KEYWORDS: Record<Exclude<ActiveSubscription, "none" | "other">, string[]> = {
  netflix: ["netflix"],
  prime: ["prime", "prime video", "amazon prime"],
  disney: ["disney", "disney+"],
  spotify: ["spotify"],
  youtube: ["youtube", "youtube premium"],
  chatgpt: ["chatgpt", "openai", "gpt"]
};

const ACTIVE_SUBSCRIPTION_REASON_LABELS: Record<Exclude<ActiveSubscription, "none" | "other">, string> = {
  netflix: "Netflix active",
  prime: "Prime Video active",
  disney: "Disney+ active",
  spotify: "Spotify active",
  youtube: "YouTube active",
  chatgpt: "ChatGPT active"
};

const DECISION_PRIORITY_REASON_LABELS: Record<DecisionPriority, string> = {
  save_money: "コスト優先",
  save_time: "時間優先",
  discover_new: "新着優先",
  avoid_regret: "後悔回避"
};

const toTimestamp = (value: string | null | undefined): number => {
  if (!value) return Number.NaN;

  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? Number.NaN : timestamp;
};

const resolveRecencyTimestamp = (card: Pick<DecisionLibraryCardRecord, "created_at" | "episode_published_at">): number => {
  const publishedAt = toTimestamp(card.episode_published_at);
  if (!Number.isNaN(publishedAt)) {
    return publishedAt;
  }

  const createdAt = toTimestamp(card.created_at);
  return Number.isNaN(createdAt) ? 0 : createdAt;
};

const compareNullableAscending = (left: number, right: number): number => {
  const leftIsNaN = Number.isNaN(left);
  const rightIsNaN = Number.isNaN(right);

  if (leftIsNaN && rightIsNaN) return 0;
  if (leftIsNaN) return 1;
  if (rightIsNaN) return -1;
  if (left === right) return 0;
  return left < right ? -1 : 1;
};

export const normalizeDecisionLibraryQuery = (value: string | null | undefined): string => {
  if (!value) return "";
  return value.trim().replace(/\s+/g, " ");
};

const normalizeForMatch = (value: string | null | undefined): string => {
  return (value ?? "").trim().toLocaleLowerCase("ja-JP");
};

const pushUnique = <T extends string>(items: T[], value: T): void => {
  if (!items.includes(value)) {
    items.push(value);
  }
};

const pushReason = (reasons: string[], reason: string): void => {
  if (!reasons.includes(reason) && reasons.length < 3) {
    reasons.push(reason);
  }
};

export const resolveDecisionLibraryUrgency = (
  deadlineAt: string | null,
  now = new Date()
): DecisionLibraryUrgency => {
  if (!deadlineAt) {
    return "no_deadline";
  }

  const deadlineTimestamp = toTimestamp(deadlineAt);
  if (Number.isNaN(deadlineTimestamp)) {
    return "no_deadline";
  }

  return deadlineTimestamp < now.getTime() ? "overdue" : "due_soon";
};

export const resolveDecisionLibraryDefaultSort = (
  preferenceProfile: UserPreferenceProfile | null | undefined
): DecisionLibrarySort => {
  if (!preferenceProfile) {
    return "newest";
  }

  if (preferenceProfile.decisionPriority === "save_money") {
    return "judgment_priority";
  }

  if (preferenceProfile.decisionPriority === "save_time" || preferenceProfile.decisionPriority === "avoid_regret") {
    return "deadline_soon";
  }

  return "newest";
};

export const buildDecisionLibraryPersonalizationSummary = (
  preferenceProfile: UserPreferenceProfile | null | undefined
): DecisionLibraryPersonalizationSummary | null => {
  if (!preferenceProfile) {
    return null;
  }

  return {
    defaultSort: resolveDecisionLibraryDefaultSort(preferenceProfile),
    interestTopics: [...preferenceProfile.interestTopics],
    activeSubscriptions: preferenceProfile.activeSubscriptions.filter(
      (subscription): subscription is Exclude<ActiveSubscription, "none"> => subscription !== "none"
    ),
    decisionPriority: preferenceProfile.decisionPriority
  };
};

export const sortDecisionLibraryCards = <T extends DecisionLibraryCardRecord>(
  cards: T[],
  sort: DecisionLibrarySort,
  now = new Date()
): T[] => {
  return [...cards].sort((left, right) => {
    if (sort === "newest") {
      return resolveRecencyTimestamp(right) - resolveRecencyTimestamp(left);
    }

    if (sort === "deadline_soon") {
      const deadlineComparison = compareNullableAscending(
        toTimestamp(left.deadline_at),
        toTimestamp(right.deadline_at)
      );

      if (deadlineComparison !== 0) {
        return deadlineComparison;
      }

      return resolveRecencyTimestamp(right) - resolveRecencyTimestamp(left);
    }

    const priorityComparison = JUDGMENT_PRIORITY[left.judgment_type] - JUDGMENT_PRIORITY[right.judgment_type];
    if (priorityComparison !== 0) {
      return priorityComparison;
    }

    const urgencyComparison =
      resolveDecisionLibraryUrgency(left.deadline_at, now) === resolveDecisionLibraryUrgency(right.deadline_at, now)
        ? 0
        : resolveDecisionLibraryUrgency(left.deadline_at, now) === "overdue"
          ? -1
          : resolveDecisionLibraryUrgency(right.deadline_at, now) === "overdue"
            ? 1
            : 0;
    if (urgencyComparison !== 0) {
      return urgencyComparison;
    }

    const deadlineComparison = compareNullableAscending(
      toTimestamp(left.deadline_at),
      toTimestamp(right.deadline_at)
    );
    if (deadlineComparison !== 0) {
      return deadlineComparison;
    }

    return resolveRecencyTimestamp(right) - resolveRecencyTimestamp(left);
  });
};

type PersonalizableDecisionLibraryCard = DecisionLibraryCardRecord & {
  topic_title: string;
  judgment_summary: string;
  frame_type: string | null;
};

export type PersonalizedDecisionLibraryCard<T> = T & {
  personalization_score: number;
  personalization_reasons: string[];
  personalization_topics: InterestTopic[];
  personalization_subscriptions: ActiveSubscription[];
};

export const scoreDecisionLibraryCardForPreferences = (
  card: PersonalizableDecisionLibraryCard,
  preferenceProfile: UserPreferenceProfile | null | undefined,
  now = new Date()
): DecisionLibraryPersonalizationSignals => {
  if (!preferenceProfile) {
    return {
      score: 0,
      reasons: [],
      matchedInterestTopics: [],
      matchedSubscriptions: []
    };
  }

  const text = normalizeForMatch([card.topic_title, card.judgment_summary, card.genre, card.frame_type].join(" "));
  const normalizedGenre = normalizeForMatch(card.genre);
  const reasons: string[] = [];
  const matchedInterestTopics: InterestTopic[] = [];
  const matchedSubscriptions: ActiveSubscription[] = [];
  let score = 0;

  for (const topic of preferenceProfile.interestTopics) {
    const aliases = INTEREST_TOPIC_GENRE_ALIASES[topic];
    if (!aliases.some((alias) => normalizedGenre === alias || text.includes(alias))) {
      continue;
    }

    pushUnique(matchedInterestTopics, topic);
    score += preferenceProfile.primaryInterestTopic === topic ? 14 : 9;
    pushReason(reasons, INTEREST_TOPIC_REASON_LABELS[topic]);
  }

  for (const subscription of preferenceProfile.activeSubscriptions) {
    if (subscription === "none") {
      continue;
    }

    if (subscription === "other") {
      score += 1;
      continue;
    }

    const keywords = ACTIVE_SUBSCRIPTION_KEYWORDS[subscription];
    if (!keywords.some((keyword) => text.includes(keyword))) {
      continue;
    }

    pushUnique(matchedSubscriptions, subscription);
    score += 10;
    pushReason(reasons, ACTIVE_SUBSCRIPTION_REASON_LABELS[subscription]);
  }

  switch (preferenceProfile.decisionPriority) {
    case "save_money":
      score += card.judgment_type === "skip" ? 8 : card.judgment_type === "watch" ? 6 : 2;
      pushReason(reasons, DECISION_PRIORITY_REASON_LABELS.save_money);
      break;
    case "save_time":
      score += card.judgment_type === "use_now" ? 7 : 3;
      if (card.deadline_at) {
        score += 4;
      }
      pushReason(reasons, DECISION_PRIORITY_REASON_LABELS.save_time);
      break;
    case "discover_new":
      score += card.judgment_type === "use_now" ? 8 : card.judgment_type === "watch" ? 3 : 0;
      pushReason(reasons, DECISION_PRIORITY_REASON_LABELS.discover_new);
      break;
    case "avoid_regret":
      score += card.judgment_type === "watch" ? 7 : 3;
      if (resolveDecisionLibraryUrgency(card.deadline_at, now) !== "no_deadline") {
        score += 4;
      }
      pushReason(reasons, DECISION_PRIORITY_REASON_LABELS.avoid_regret);
      break;
  }

  if (preferenceProfile.moneySensitive && card.judgment_type !== "use_now") {
    score += 2;
  }

  if (preferenceProfile.timeSensitive && card.deadline_at) {
    score += 2;
  }

  return {
    score,
    reasons,
    matchedInterestTopics,
    matchedSubscriptions
  };
};

export const personalizeDecisionLibraryCards = <T extends PersonalizableDecisionLibraryCard>(
  cards: T[],
  preferenceProfile: UserPreferenceProfile | null | undefined,
  sort: DecisionLibrarySort,
  now = new Date()
): Array<PersonalizedDecisionLibraryCard<T>> => {
  const baseSorted = sortDecisionLibraryCards(cards, sort, now);

  if (!preferenceProfile) {
    return baseSorted.map((card) => ({
      ...card,
      personalization_score: 0,
      personalization_reasons: [],
      personalization_topics: [],
      personalization_subscriptions: []
    }));
  }

  const decorated = baseSorted.map((card, index) => {
    const signals = scoreDecisionLibraryCardForPreferences(card, preferenceProfile, now);

    return {
      ...card,
      personalization_score: signals.score,
      personalization_reasons: signals.reasons,
      personalization_topics: signals.matchedInterestTopics,
      personalization_subscriptions: signals.matchedSubscriptions,
      base_index: index
    };
  });

  return decorated
    .sort((left, right) => {
      if (right.personalization_score !== left.personalization_score) {
        return right.personalization_score - left.personalization_score;
      }

      return left.base_index - right.base_index;
    })
    .map((card) => {
      const { base_index, ...personalizedCard } = card;
      return personalizedCard;
    }) as Array<PersonalizedDecisionLibraryCard<T>>;
};

const matchesQuery = (card: DecisionLibraryCardRecord, query: string): boolean => {
  if (!query) return true;

  const normalizedQuery = query.toLocaleLowerCase("ja-JP");
  const haystack = [card.topic_title, card.judgment_summary].join(" ").toLocaleLowerCase("ja-JP");
  return haystack.includes(normalizedQuery);
};

export const applyDecisionLibraryFilters = <T extends DecisionLibraryCardRecord>(
  cards: T[],
  filters: DecisionLibraryFilters,
  now = new Date()
): T[] => {
  const query = normalizeDecisionLibraryQuery(filters.query);

  return sortDecisionLibraryCards(
    cards.filter((card) => {
      if (!matchesQuery(card, query)) return false;
      if (filters.genre && card.genre !== filters.genre) return false;
      if (filters.frameType && card.frame_type !== filters.frameType) return false;
      if (filters.judgmentType && card.judgment_type !== filters.judgmentType) return false;
      if (filters.urgency && resolveDecisionLibraryUrgency(card.deadline_at, now) !== filters.urgency) return false;
      return true;
    }),
    filters.sort,
    now
  );
};

export const lockDecisionLibraryCardDetails = <T extends GateableDecisionLibraryCard>(card: T): T => {
  return {
    ...card,
    action_text: null,
    deadline_at: null,
    threshold_json: {},
    watch_points: []
  };
};
