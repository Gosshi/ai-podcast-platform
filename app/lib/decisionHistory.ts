import type { JudgmentCard, JudgmentThresholdJson, JudgmentType } from "../../src/lib/judgmentCards";
import type { DecisionProfile, DecisionProfileEntry } from "../../src/lib/decisionProfile";
import { JUDGMENT_TYPE_LABELS } from "./uiText.ts";

export type DecisionOutcomeValue = "success" | "regret" | "neutral";
export type DecisionOutcome = DecisionOutcomeValue | null;

export type SavedDecisionRecord = {
  id: string;
  judgment_card_id: string;
  outcome: DecisionOutcome;
};

export type SavedJudgmentCard = JudgmentCard & {
  is_saved: boolean;
  saved_decision_id: string | null;
  saved_outcome: DecisionOutcome | null;
};

export type DecisionHistorySource = "episode" | "ai_generated";

export type DecisionHistoryEntry = {
  id: string;
  judgment_card_id: string;
  episode_id: string;
  topic_title: string;
  frame_type: string | null;
  genre: string | null;
  decision_type: JudgmentType;
  outcome: DecisionOutcome;
  threshold_json: JudgmentThresholdJson;
  deadline_at: string | null;
  created_at: string;
  updated_at: string;
  episode_title: string | null;
  episode_published_at: string | null;
  source: DecisionHistorySource;
  input_text?: string | null;
};

export type DecisionHistoryStats = {
  totalDecisions: number;
  resolvedCount: number;
  unresolvedCount: number;
  successCount: number;
  regretCount: number;
  neutralCount: number;
  successRate: number;
};

type UserDecisionRow = {
  id: string;
  judgment_card_id: string;
  episode_id: string;
  decision_type: JudgmentType;
  outcome: DecisionOutcome;
  created_at: string;
  updated_at: string;
};

type DecisionCardLookupRow = {
  id: string;
  topic_title: string;
  frame_type: string | null;
  genre: string | null;
  threshold_json: JudgmentThresholdJson | null;
  deadline_at: string | null;
};

type EpisodeLookupRow = {
  id: string;
  title: string | null;
  published_at: string | null;
};

const SUPABASE_BATCH_SIZE = 80;

export const FREE_DECISION_HISTORY_LIMIT = 10;
export const UNRESOLVED_OUTCOME_LABEL = "未記録";
export const DECISION_TYPE_LABELS = JUDGMENT_TYPE_LABELS;

export const OUTCOME_LABELS: Record<DecisionOutcomeValue, string> = {
  success: "満足",
  regret: "後悔",
  neutral: "普通"
};

const createEmptyDecisionProfile = (): DecisionProfile => ({
  totalDecisions: 0,
  minimumHistoryMet: false,
  decisionRatios: {
    use_now: { count: 0, percentage: 0 },
    watch: { count: 0, percentage: 0 },
    skip: { count: 0, percentage: 0 }
  },
  outcomeRatios: {
    success: { count: 0, percentage: 0 },
    regret: { count: 0, percentage: 0 },
    neutral: { count: 0, percentage: 0 }
  },
  decisionTypeStats: {
    use_now: {
      key: "use_now",
      label: "採用",
      count: 0,
      successCount: 0,
      regretCount: 0,
      neutralCount: 0,
      successRate: 0,
      regretRate: 0,
      neutralRate: 0,
      useNowCount: 0,
      watchCount: 0,
      skipCount: 0,
      useNowRate: 0,
      watchRate: 0,
      skipRate: 0,
      dominantDecisionType: null
    },
    watch: {
      key: "watch",
      label: "様子見",
      count: 0,
      successCount: 0,
      regretCount: 0,
      neutralCount: 0,
      successRate: 0,
      regretRate: 0,
      neutralRate: 0,
      useNowCount: 0,
      watchCount: 0,
      skipCount: 0,
      useNowRate: 0,
      watchRate: 0,
      skipRate: 0,
      dominantDecisionType: null
    },
    skip: {
      key: "skip",
      label: "見送る",
      count: 0,
      successCount: 0,
      regretCount: 0,
      neutralCount: 0,
      successRate: 0,
      regretRate: 0,
      neutralRate: 0,
      useNowCount: 0,
      watchCount: 0,
      skipCount: 0,
      useNowRate: 0,
      watchRate: 0,
      skipRate: 0,
      dominantDecisionType: null
    }
  },
  frameTypeStats: [],
  genreStats: [],
  signalStats: [],
  topGenres: [],
  regretGenres: [],
  bestFrameType: null,
  riskyFrameType: null,
  favoriteFrameTypes: [],
  insights: []
});

export const isDecisionOutcomeValue = (value: unknown): value is DecisionOutcomeValue => {
  return value === "success" || value === "regret" || value === "neutral";
};

export const formatDecisionOutcomeLabel = (value: DecisionOutcome): string => {
  if (!value) {
    return UNRESOLVED_OUTCOME_LABEL;
  }

  return OUTCOME_LABELS[value];
};

export const hasDecisionOutcome = (value: DecisionOutcome): value is DecisionOutcomeValue => {
  return isDecisionOutcomeValue(value);
};

export const hasReachedDecisionHistoryLimit = (count: number, isPaid: boolean): boolean => {
  return !isPaid && count >= FREE_DECISION_HISTORY_LIMIT;
};

export const calculateDecisionHistoryStats = (
  entries: Array<Pick<DecisionHistoryEntry, "outcome">>
): DecisionHistoryStats => {
  const successCount = entries.filter((entry) => entry.outcome === "success").length;
  const regretCount = entries.filter((entry) => entry.outcome === "regret").length;
  const neutralCount = entries.filter((entry) => entry.outcome === "neutral").length;
  const totalDecisions = entries.length;
  const resolvedCount = successCount + regretCount + neutralCount;
  const unresolvedCount = totalDecisions - resolvedCount;

  return {
    totalDecisions,
    resolvedCount,
    unresolvedCount,
    successCount,
    regretCount,
    neutralCount,
    successRate: resolvedCount > 0 ? Math.round((successCount / resolvedCount) * 100) : 0
  };
};

export const formatDecisionHistoryDate = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
};

export const loadSavedDecisions = async (
  userId: string,
  judgmentCardIds: string[]
): Promise<{ savedDecisions: Map<string, SavedDecisionRecord>; error: string | null }> => {
  if (!userId || judgmentCardIds.length === 0) {
    return {
      savedDecisions: new Map<string, SavedDecisionRecord>(),
      error: null
    };
  }

  try {
    const { createServiceRoleClient } = await import("./supabaseClients");
    const supabase = createServiceRoleClient();
    const rows: SavedDecisionRecord[] = [];

    for (let index = 0; index < judgmentCardIds.length; index += SUPABASE_BATCH_SIZE) {
      const batch = judgmentCardIds.slice(index, index + SUPABASE_BATCH_SIZE);
      const { data, error } = await supabase
        .from("user_decisions")
        .select("id, judgment_card_id, outcome")
        .eq("user_id", userId)
        .in("judgment_card_id", batch);

      if (error) {
        return {
          savedDecisions: new Map<string, SavedDecisionRecord>(),
          error: error.message
        };
      }

      rows.push(...((data as SavedDecisionRecord[] | null) ?? []));
    }

    return {
      savedDecisions: rows.reduce((map, row) => {
        map.set(row.judgment_card_id, row);
        return map;
      }, new Map<string, SavedDecisionRecord>()),
      error: null
    };
  } catch (error) {
    return {
      savedDecisions: new Map<string, SavedDecisionRecord>(),
      error: error instanceof Error ? error.message : "unknown_error"
    };
  }
};

export const attachSavedDecisionState = (
  cards: JudgmentCard[],
  savedDecisions: Map<string, SavedDecisionRecord>
): SavedJudgmentCard[] => {
  return cards.map((card) => {
    const savedDecision = card.id ? savedDecisions.get(card.id) : null;

    return {
      ...card,
      is_saved: Boolean(savedDecision),
      saved_decision_id: savedDecision?.id ?? null,
      saved_outcome: savedDecision?.outcome ?? null
    };
  });
};

type GeneratedCardRow = {
  id: string;
  input_text: string;
  genre: string | null;
  topic_title: string;
  frame_type: string | null;
  judgment_type: JudgmentType;
  judgment_summary: string;
  action_text: string | null;
  deadline_at: string | null;
  threshold_json: JudgmentThresholdJson | null;
  watch_points_json: unknown;
  confidence_score: number | null;
  outcome: DecisionOutcome;
  created_at: string;
  updated_at: string;
};

const loadGeneratedCardEntries = async (
  userId: string,
  supabase: Awaited<ReturnType<typeof import("./supabaseClients").createServiceRoleClient>>
): Promise<DecisionHistoryEntry[]> => {
  const { data, error } = await supabase
    .from("user_generated_cards")
    .select("id, input_text, genre, topic_title, frame_type, judgment_type, judgment_summary, action_text, deadline_at, threshold_json, watch_points_json, confidence_score, outcome, created_at, updated_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error || !data) {
    return [];
  }

  return (data as GeneratedCardRow[]).map((row) => ({
    id: `gen_${row.id}`,
    judgment_card_id: row.id,
    episode_id: "",
    topic_title: row.topic_title,
    frame_type: row.frame_type,
    genre: row.genre,
    decision_type: row.judgment_type,
    outcome: row.outcome,
    threshold_json: row.threshold_json ?? {},
    deadline_at: row.deadline_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
    episode_title: null,
    episode_published_at: null,
    source: "ai_generated" as const,
    input_text: row.input_text
  }));
};

export const loadDecisionHistory = async (
  userId: string
): Promise<{ entries: DecisionHistoryEntry[]; stats: DecisionHistoryStats; profile: DecisionProfile; error: string | null }> => {
  if (!userId) {
    return {
      entries: [],
      stats: calculateDecisionHistoryStats([]),
      profile: createEmptyDecisionProfile(),
      error: null
    };
  }

  try {
    const { createServiceRoleClient } = await import("./supabaseClients");
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from("user_decisions")
      .select("id, judgment_card_id, episode_id, decision_type, outcome, created_at, updated_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) {
      return {
        entries: [],
        stats: calculateDecisionHistoryStats([]),
        profile: createEmptyDecisionProfile(),
        error: error.message
      };
    }

    const decisions = (data as UserDecisionRow[] | null) ?? [];
    const judgmentCardIds = Array.from(new Set(decisions.map((decision) => decision.judgment_card_id)));
    const episodeIds = Array.from(new Set(decisions.map((decision) => decision.episode_id)));

    const batchSelect = async <T>(
      ids: string[],
      queryBuilder: (batch: string[]) => PromiseLike<{ data: unknown; error: { message: string } | null }>
    ): Promise<{ data: T[]; error: { message: string } | null }> => {
      if (ids.length === 0) {
        return { data: [], error: null };
      }

      const rows: T[] = [];

      for (let index = 0; index < ids.length; index += SUPABASE_BATCH_SIZE) {
        const batch = ids.slice(index, index + SUPABASE_BATCH_SIZE);
        const { data, error } = await queryBuilder(batch);

        if (error) {
          return { data: [], error };
        }

        rows.push(...(((data as T[] | null) ?? [])));
      }

      return { data: rows, error: null };
    };

    const [{ data: judgmentCardsData, error: judgmentCardsError }, { data: episodesData, error: episodesError }] =
      await Promise.all([
        batchSelect<DecisionCardLookupRow>(judgmentCardIds, (batch) =>
          supabase
            .from("episode_judgment_cards")
            .select("id, topic_title, frame_type, genre, threshold_json, deadline_at")
            .in("id", batch)
        ),
        batchSelect<EpisodeLookupRow>(episodeIds, (batch) =>
          supabase.from("episodes").select("id, title, published_at").in("id", batch)
        )
      ]);

    if (judgmentCardsError) {
      return {
        entries: [],
        stats: calculateDecisionHistoryStats([]),
        profile: createEmptyDecisionProfile(),
        error: judgmentCardsError.message
      };
    }

    if (episodesError) {
      return {
        entries: [],
        stats: calculateDecisionHistoryStats([]),
        profile: createEmptyDecisionProfile(),
        error: episodesError.message
      };
    }

    const judgmentCards = ((judgmentCardsData as DecisionCardLookupRow[] | null) ?? []).reduce((map, card) => {
      map.set(card.id, card);
      return map;
    }, new Map<string, DecisionCardLookupRow>());
    const episodes = ((episodesData as EpisodeLookupRow[] | null) ?? []).reduce((map, episode) => {
      map.set(episode.id, episode);
      return map;
    }, new Map<string, EpisodeLookupRow>());

    const episodeEntries = decisions.map((decision) => {
      const card = judgmentCards.get(decision.judgment_card_id);
      const episode = episodes.get(decision.episode_id);

      return {
        id: decision.id,
        judgment_card_id: decision.judgment_card_id,
        episode_id: decision.episode_id,
        topic_title: card?.topic_title ?? "Unknown topic",
        frame_type: card?.frame_type ?? null,
        genre: card?.genre ?? null,
        decision_type: decision.decision_type,
        outcome: decision.outcome,
        threshold_json: card?.threshold_json ?? {},
        deadline_at: card?.deadline_at ?? null,
        created_at: decision.created_at,
        updated_at: decision.updated_at,
        episode_title: episode?.title ?? null,
        episode_published_at: episode?.published_at ?? null,
        source: "episode" as const
      } satisfies DecisionHistoryEntry;
    });

    const generatedEntries = await loadGeneratedCardEntries(userId, supabase);

    const entries = [...episodeEntries, ...generatedEntries].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    const resolvedEntries: DecisionProfileEntry[] = entries.flatMap((entry) => {
      if (!hasDecisionOutcome(entry.outcome)) {
        return [];
      }

      return [
        {
          decision_type: entry.decision_type,
          outcome: entry.outcome,
          frame_type: entry.frame_type,
          genre: entry.genre,
          threshold_json: entry.threshold_json
        }
      ];
    });

    return {
      entries,
      stats: calculateDecisionHistoryStats(entries),
      profile: (await import("../../src/lib/decisionProfile")).buildPersonalDecisionProfile(resolvedEntries),
      error: null
    };
  } catch (error) {
    return {
      entries: [],
      stats: calculateDecisionHistoryStats([]),
      profile: createEmptyDecisionProfile(),
      error: error instanceof Error ? error.message : "unknown_error"
    };
  }
};
