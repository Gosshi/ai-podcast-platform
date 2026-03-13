import type { JudgmentType } from "@/src/lib/judgmentCards";
import { buildWeeklyDecisionDigest } from "@/src/lib/weeklyDecisionDigest";
import { createServiceRoleClient } from "./supabaseClients";

type JoinedEpisodeRow = {
  id: string;
  title: string | null;
  lang: "ja" | "en";
  genre: string | null;
  status: "draft" | "queued" | "generating" | "ready" | "published" | "failed";
  published_at: string | null;
};

type WeeklyDigestQueryRow = {
  id: string;
  episode_id: string;
  topic_title: string;
  judgment_type: JudgmentType;
  judgment_summary: string;
  deadline_at: string | null;
  genre: string | null;
  frame_type: string | null;
  created_at: string;
  episodes: JoinedEpisodeRow | JoinedEpisodeRow[] | null;
};

export type WeeklyDecisionDigestItem = {
  id: string;
  episode_id: string;
  episode_title: string | null;
  episode_published_at: string | null;
  topic_title: string;
  judgment_type: JudgmentType;
  judgment_summary: string;
  deadline_at: string | null;
  genre: string | null;
  frame_type: string | null;
  created_at: string;
};

export type WeeklyDecisionDigestResult = {
  windowStart: string;
  windowEnd: string;
  grouped: Record<JudgmentType, WeeklyDecisionDigestItem[]>;
  counts: Record<JudgmentType, number>;
  genreBreakdown: { key: string; count: number }[];
  frameTypeBreakdown: { key: string; count: number }[];
  previewLimited: boolean;
};

const resolveJoinedEpisode = (
  value: JoinedEpisodeRow | JoinedEpisodeRow[] | null
): JoinedEpisodeRow | null => {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
};

export const loadWeeklyDecisionDigest = async (params: {
  isPaid: boolean;
}): Promise<{ digest: WeeklyDecisionDigestResult; error: string | null }> => {
  const windowEnd = new Date();
  const windowStart = new Date(windowEnd.getTime() - 7 * 24 * 60 * 60 * 1000);

  const emptyDigest: WeeklyDecisionDigestResult = {
    windowStart: windowStart.toISOString(),
    windowEnd: windowEnd.toISOString(),
    grouped: {
      use_now: [],
      watch: [],
      skip: []
    },
    counts: {
      use_now: 0,
      watch: 0,
      skip: 0
    },
    genreBreakdown: [],
    frameTypeBreakdown: [],
    previewLimited: false
  };

  try {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from("episode_judgment_cards")
      .select(
        "id, episode_id, topic_title, judgment_type, judgment_summary, deadline_at, genre, frame_type, created_at, episodes!inner(id, title, lang, genre, status, published_at)"
      )
      .eq("episodes.status", "published")
      .gte("episodes.published_at", windowStart.toISOString())
      .lte("episodes.published_at", windowEnd.toISOString())
      .order("deadline_at", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(120);

    if (error) {
      return {
        digest: emptyDigest,
        error: error.message
      };
    }

    const cards = ((data as WeeklyDigestQueryRow[] | null) ?? [])
      .map((row) => {
        const episode = resolveJoinedEpisode(row.episodes);
        if (!episode) return null;

        return {
          id: row.id,
          episode_id: row.episode_id,
          episode_title: episode.title,
          episode_published_at: episode.published_at,
          topic_title: row.topic_title,
          judgment_type: row.judgment_type,
          judgment_summary: row.judgment_summary,
          deadline_at: params.isPaid ? row.deadline_at : null,
          genre: row.genre ?? episode.genre,
          frame_type: row.frame_type,
          created_at: row.created_at
        } satisfies WeeklyDecisionDigestItem;
      })
      .filter((card): card is WeeklyDecisionDigestItem => Boolean(card));

    const summary = buildWeeklyDecisionDigest(cards, params.isPaid ? null : 1);

    return {
      digest: {
        windowStart: windowStart.toISOString(),
        windowEnd: windowEnd.toISOString(),
        grouped: summary.groupedVisible,
        counts: summary.counts,
        genreBreakdown: summary.genreBreakdown,
        frameTypeBreakdown: summary.frameTypeBreakdown,
        previewLimited: summary.previewLimited
      },
      error: null
    };
  } catch (error) {
    return {
      digest: emptyDigest,
      error: error instanceof Error ? error.message : "unknown_error"
    };
  }
};
