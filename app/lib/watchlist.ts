import type { JudgmentType } from "@/src/lib/judgmentCards";
import {
  applyWatchlistFilters,
  resolveWatchlistUrgency,
  type WatchlistCardState,
  type WatchlistFilters,
  type WatchlistRecord,
  type WatchlistStatus,
  type WatchlistUrgency
} from "@/src/lib/watchlist";
import { createServiceRoleClient } from "./supabaseClients";

type WatchlistCardLookupRow = {
  id: string;
  topic_title: string;
  judgment_type: JudgmentType;
  frame_type: string | null;
  genre: string | null;
  deadline_at: string | null;
};

type WatchlistEpisodeLookupRow = {
  id: string;
  title: string | null;
  published_at: string | null;
};

type WatchlistDecisionLookupRow = {
  id: string;
  judgment_card_id: string;
};

export type WatchlistEntry = WatchlistRecord & {
  topic_title: string;
  judgment_type: JudgmentType;
  frame_type: string | null;
  genre: string | null;
  deadline_at: string | null;
  urgency: WatchlistUrgency;
  episode_title: string | null;
  episode_published_at: string | null;
  history_decision_id: string | null;
};

export type WatchlistResult = {
  items: WatchlistEntry[];
  options: {
    genres: string[];
    frameTypes: string[];
  };
  error: string | null;
};

export const loadWatchlistRecords = async (
  userId: string,
  judgmentCardIds: string[]
): Promise<{ watchlist: Map<string, WatchlistRecord>; error: string | null }> => {
  if (!userId || judgmentCardIds.length === 0) {
    return {
      watchlist: new Map<string, WatchlistRecord>(),
      error: null
    };
  }

  try {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from("user_watchlist_items")
      .select("id, judgment_card_id, episode_id, status, created_at, updated_at")
      .eq("user_id", userId)
      .in("judgment_card_id", judgmentCardIds);

    if (error) {
      return {
        watchlist: new Map<string, WatchlistRecord>(),
        error: error.message
      };
    }

    const rows = (data as WatchlistRecord[] | null) ?? [];
    return {
      watchlist: rows.reduce((map, row) => {
        map.set(row.judgment_card_id, row);
        return map;
      }, new Map<string, WatchlistRecord>()),
      error: null
    };
  } catch (error) {
    return {
      watchlist: new Map<string, WatchlistRecord>(),
      error: error instanceof Error ? error.message : "unknown_error"
    };
  }
};

export const attachWatchlistState = <
  T extends {
    id?: string;
  }
>(
  items: T[],
  watchlist: Map<string, WatchlistRecord>
): Array<T & WatchlistCardState> => {
  return items.map((item) => {
    const watchlistItem = item.id ? watchlist.get(item.id) : null;

    return {
      ...item,
      is_in_watchlist: Boolean(watchlistItem),
      watchlist_item_id: watchlistItem?.id ?? null,
      watchlist_status: watchlistItem?.status ?? null,
      watchlist_created_at: watchlistItem?.created_at ?? null,
      watchlist_updated_at: watchlistItem?.updated_at ?? null
    } as T & WatchlistCardState;
  });
};

export const countActiveWatchlistItems = async (
  userId: string
): Promise<{ count: number; error: string | null }> => {
  try {
    const supabase = createServiceRoleClient();
    const { count, error } = await supabase
      .from("user_watchlist_items")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .in("status", ["saved", "watching"]);

    return {
      count: count ?? 0,
      error: error?.message ?? null
    };
  } catch (error) {
    return {
      count: 0,
      error: error instanceof Error ? error.message : "unknown_error"
    };
  }
};

export const loadUserWatchlist = async (params: {
  userId: string;
  filters: WatchlistFilters;
}): Promise<WatchlistResult> => {
  if (!params.userId) {
    return {
      items: [],
      options: {
        genres: [],
        frameTypes: []
      },
      error: null
    };
  }

  try {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from("user_watchlist_items")
      .select("id, judgment_card_id, episode_id, status, created_at, updated_at")
      .eq("user_id", params.userId)
      .order("created_at", { ascending: false })
      .limit(300);

    if (error) {
      return {
        items: [],
        options: {
          genres: [],
          frameTypes: []
        },
        error: error.message
      };
    }

    const watchlistRows = (data as WatchlistRecord[] | null) ?? [];
    if (watchlistRows.length === 0) {
      return {
        items: [],
        options: {
          genres: [],
          frameTypes: []
        },
        error: null
      };
    }

    const judgmentCardIds = Array.from(new Set(watchlistRows.map((item) => item.judgment_card_id)));
    const episodeIds = Array.from(new Set(watchlistRows.map((item) => item.episode_id)));

    const [{ data: cardsData, error: cardsError }, { data: episodesData, error: episodesError }, { data: decisionsData, error: decisionsError }] =
      await Promise.all([
        supabase
          .from("episode_judgment_cards")
          .select("id, topic_title, judgment_type, frame_type, genre, deadline_at")
          .in("id", judgmentCardIds),
        supabase.from("episodes").select("id, title, published_at").in("id", episodeIds),
        supabase
          .from("user_decisions")
          .select("id, judgment_card_id")
          .eq("user_id", params.userId)
          .in("judgment_card_id", judgmentCardIds)
      ]);

    if (cardsError) {
      return {
        items: [],
        options: {
          genres: [],
          frameTypes: []
        },
        error: cardsError.message
      };
    }

    if (episodesError) {
      return {
        items: [],
        options: {
          genres: [],
          frameTypes: []
        },
        error: episodesError.message
      };
    }

    if (decisionsError) {
      return {
        items: [],
        options: {
          genres: [],
          frameTypes: []
        },
        error: decisionsError.message
      };
    }

    const cards = ((cardsData as WatchlistCardLookupRow[] | null) ?? []).reduce((map, card) => {
      map.set(card.id, card);
      return map;
    }, new Map<string, WatchlistCardLookupRow>());
    const episodes = ((episodesData as WatchlistEpisodeLookupRow[] | null) ?? []).reduce((map, episode) => {
      map.set(episode.id, episode);
      return map;
    }, new Map<string, WatchlistEpisodeLookupRow>());
    const decisions = ((decisionsData as WatchlistDecisionLookupRow[] | null) ?? []).reduce((map, decision) => {
      map.set(decision.judgment_card_id, decision.id);
      return map;
    }, new Map<string, string>());

    const items = watchlistRows.flatMap((item) => {
      const card = cards.get(item.judgment_card_id);
      if (!card) return [];

      const episode = episodes.get(item.episode_id);

      return [
        {
          ...item,
          topic_title: card.topic_title,
          judgment_type: card.judgment_type,
          frame_type: card.frame_type,
          genre: card.genre,
          deadline_at: card.deadline_at,
          urgency: resolveWatchlistUrgency(card.deadline_at),
          episode_title: episode?.title ?? null,
          episode_published_at: episode?.published_at ?? null,
          history_decision_id: decisions.get(item.judgment_card_id) ?? null
        } satisfies WatchlistEntry
      ];
    });

    const filteredItems = applyWatchlistFilters(items, params.filters);
    const genres = new Set<string>();
    const frameTypes = new Set<string>();

    for (const item of items) {
      if (item.genre) {
        genres.add(item.genre);
      }

      if (item.frame_type) {
        frameTypes.add(item.frame_type);
      }
    }

    return {
      items: filteredItems,
      options: {
        genres: [...genres].sort((left, right) => left.localeCompare(right, "ja-JP")),
        frameTypes: [...frameTypes].sort((left, right) => left.localeCompare(right, "ja-JP"))
      },
      error: null
    };
  } catch (error) {
    return {
      items: [],
      options: {
        genres: [],
        frameTypes: []
      },
      error: error instanceof Error ? error.message : "unknown_error"
    };
  }
};
