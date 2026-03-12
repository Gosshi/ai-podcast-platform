import type { JudgmentCard } from "../../../src/lib/judgmentCards.ts";
import { extractJudgmentCards } from "../../../src/lib/judgmentCards.ts";
import { supabaseAdmin } from "./supabaseAdmin.ts";

type SyncEpisodeJudgmentCardsParams = {
  episodeId: string;
  lang: "ja" | "en";
  genre?: string | null;
  cards: JudgmentCard[];
};

export type JudgmentCardSyncResult = {
  cards: JudgmentCard[];
  extractedCount: number;
  persistedCount: number;
  error: string | null;
};

const toPersistedRows = (
  params: SyncEpisodeJudgmentCardsParams
): Record<string, unknown>[] => {
  return params.cards.map((card) => ({
    episode_id: params.episodeId,
    lang: params.lang,
    ...(params.genre !== undefined ? { genre: params.genre ?? null } : {}),
    topic_order: card.topic_order,
    topic_title: card.topic_title,
    frame_type: card.frame_type,
    judgment_type: card.judgment_type,
    judgment_summary: card.judgment_summary,
    action_text: card.action_text,
    deadline_at: card.deadline_at,
    threshold_json: card.threshold_json,
    watch_points_json: card.watch_points,
    confidence_score: card.confidence_score
  }));
};

export const syncEpisodeJudgmentCards = async (
  params: SyncEpisodeJudgmentCardsParams
): Promise<JudgmentCardSyncResult> => {
  try {
    if (params.cards.length === 0) {
      const { error } = await supabaseAdmin
        .from("episode_judgment_cards")
        .delete()
        .eq("episode_id", params.episodeId);

      if (error) {
        throw error;
      }

      return {
        cards: [],
        extractedCount: 0,
        persistedCount: 0,
        error: null
      };
    }

    const rows = toPersistedRows(params);
    const { error: upsertError } = await supabaseAdmin
      .from("episode_judgment_cards")
      .upsert(rows, {
        onConflict: "episode_id,topic_order"
      });

    if (upsertError) {
      throw upsertError;
    }

    const maxTopicOrder = Math.max(...params.cards.map((card) => card.topic_order));
    const { error: cleanupError } = await supabaseAdmin
      .from("episode_judgment_cards")
      .delete()
      .eq("episode_id", params.episodeId)
      .gt("topic_order", maxTopicOrder);

    if (cleanupError) {
      throw cleanupError;
    }

    return {
      cards: params.cards,
      extractedCount: params.cards.length,
      persistedCount: params.cards.length,
      error: null
    };
  } catch (error) {
    return {
      cards: params.cards,
      extractedCount: params.cards.length,
      persistedCount: 0,
      error: error instanceof Error ? error.message : String(error)
    };
  }
};

export const syncEpisodeJudgmentCardsForScript = async (params: {
  episodeId: string;
  lang: "ja" | "en";
  genre?: string | null;
  script: string | null | undefined;
}): Promise<JudgmentCardSyncResult> => {
  const cards = extractJudgmentCards(params.script);
  return syncEpisodeJudgmentCards({
    episodeId: params.episodeId,
    lang: params.lang,
    genre: params.genre ?? null,
    cards
  });
};
