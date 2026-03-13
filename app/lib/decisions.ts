import type { JudgmentThresholdJson, JudgmentType } from "@/src/lib/judgmentCards";
import { sortDecisionDashboardCards } from "@/src/lib/decisionDashboard";
import { isWithinFreeAccessWindow } from "./contentAccess";
import { loadSavedDecisions, type DecisionOutcome } from "./decisionHistory";
import { lockJudgmentDetails } from "./judgmentAccess";
import { createServiceRoleClient } from "./supabaseClients";

type JoinedEpisodeRow = {
  id: string;
  title: string | null;
  lang: "ja" | "en";
  genre: string | null;
  status: "draft" | "queued" | "generating" | "ready" | "published" | "failed";
  created_at: string;
  published_at: string | null;
};

type DecisionDashboardQueryRow = {
  id: string;
  episode_id: string;
  genre: string | null;
  topic_title: string;
  frame_type: string | null;
  judgment_type: JudgmentType;
  judgment_summary: string;
  action_text: string | null;
  deadline_at: string | null;
  threshold_json: JudgmentThresholdJson | null;
  watch_points_json: string[] | null;
  created_at: string;
  episodes: JoinedEpisodeRow | JoinedEpisodeRow[] | null;
};

export type DecisionDashboardCard = {
  id: string;
  episode_id: string;
  topic_title: string;
  judgment_type: JudgmentType;
  judgment_summary: string;
  action_text: string | null;
  deadline_at: string | null;
  threshold_json: JudgmentThresholdJson;
  watch_points: string[];
  frame_type: string | null;
  genre: string | null;
  created_at: string;
  episode_title: string | null;
  episode_lang: "ja" | "en";
  episode_published_at: string | null;
  is_saved: boolean;
  saved_decision_id: string | null;
  saved_outcome: DecisionOutcome | null;
};

const resolveJoinedEpisode = (
  value: JoinedEpisodeRow | JoinedEpisodeRow[] | null
): JoinedEpisodeRow | null => {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
};

export const loadDecisionDashboardCards = async (params: {
  isPaid: boolean;
  userId?: string | null;
}): Promise<{ cards: DecisionDashboardCard[]; error: string | null }> => {
  const limit = 80;

  try {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from("episode_judgment_cards")
      .select(
        "id, episode_id, genre, topic_title, frame_type, judgment_type, judgment_summary, action_text, deadline_at, threshold_json, watch_points_json, created_at, episodes!inner(id, title, lang, genre, status, created_at, published_at)"
      )
      .eq("episodes.status", "published")
      .not("episodes.published_at", "is", null)
      .order("deadline_at", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      return {
        cards: [],
        error: error.message
      };
    }

    const rows = (data as DecisionDashboardQueryRow[] | null) ?? [];
    const cards = rows
      .map((row) => {
        const episode = resolveJoinedEpisode(row.episodes);
        if (!episode) return null;

        const card: DecisionDashboardCard = {
          id: row.id,
          episode_id: row.episode_id,
          topic_title: row.topic_title,
          frame_type: row.frame_type,
          judgment_type: row.judgment_type,
          judgment_summary: row.judgment_summary,
          action_text: row.action_text,
          deadline_at: row.deadline_at,
          threshold_json: row.threshold_json ?? {},
          watch_points: Array.isArray(row.watch_points_json) ? row.watch_points_json : [],
          genre: row.genre ?? episode.genre,
          created_at: row.created_at,
          episode_title: episode.title,
          episode_lang: episode.lang,
          episode_published_at: episode.published_at,
          is_saved: false,
          saved_decision_id: null,
          saved_outcome: null
        };

        return card;
      })
      .filter((card): card is DecisionDashboardCard => Boolean(card));

    const visibleCards = params.isPaid
      ? cards
      : cards
          .filter((card) => isWithinFreeAccessWindow(card.episode_published_at ?? card.created_at))
          .map((card) => lockJudgmentDetails(card));
    const { savedDecisions, error: savedDecisionsError } = params.userId
      ? await loadSavedDecisions(params.userId, visibleCards.map((card) => card.id))
      : { savedDecisions: new Map(), error: null };

    return {
      cards: sortDecisionDashboardCards(
        visibleCards.map((card) => {
          const savedDecision = savedDecisions.get(card.id);
          return {
            ...card,
            is_saved: Boolean(savedDecision),
            saved_decision_id: savedDecision?.id ?? null,
            saved_outcome: savedDecision?.outcome ?? null
          };
        })
      ),
      error: savedDecisionsError
    };
  } catch (error) {
    return {
      cards: [],
      error: error instanceof Error ? error.message : "unknown_error"
    };
  }
};
