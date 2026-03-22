export const runtime = "nodejs";

import { jsonResponse } from "@/app/lib/apiResponse";
import { verifyCronSecret } from "@/app/lib/cronAuth";
import { createServiceRoleClient } from "@/app/lib/supabaseClients";
import { DEFAULT_SITE_URL } from "@/src/lib/brand";
import { buildPublicEpisodePath } from "@/src/lib/episodeLinks";
import { resolveDisplayEpisodeTitle } from "@/src/lib/episodeTitles";
import {
  publishPostToX,
  resolveXAutoPostStatus
} from "@/src/lib/social/xPublisher";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? DEFAULT_SITE_URL;

const HASHTAGS = "#判断のじかん #AIポッドキャスト";

/** Max tweet length (280 chars). We leave room for the URL + hashtags. */
const TWEET_MAX_LENGTH = 280;

type LatestEpisodeRow = {
  id: string;
  title: string | null;
  description: string | null;
  genre: string | null;
  published_at: string | null;
  created_at: string;
};

type JudgmentCardTitleRow = {
  topic_order: number;
  topic_title: string;
};

const fetchLatestJapaneseEpisode = async (): Promise<{
  episode: LatestEpisodeRow | null;
  cardCount: number;
  judgmentCards: JudgmentCardTitleRow[];
  error: string | null;
}> => {
  const supabase = createServiceRoleClient();

  const { data, error } = await supabase
    .from("episodes")
    .select("id, title, description, genre, published_at, created_at")
    .eq("status", "published")
    .eq("lang", "ja")
    .not("published_at", "is", null)
    .order("published_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return { episode: null, cardCount: 0, judgmentCards: [], error: error.message };
  }

  const episode = data as LatestEpisodeRow | null;
  if (!episode) {
    return { episode: null, cardCount: 0, judgmentCards: [], error: null };
  }

  const { data: judgmentCards, count, error: countError } = await supabase
    .from("episode_judgment_cards")
    .select("topic_order, topic_title", { count: "exact" })
    .eq("episode_id", episode.id);

  if (countError) {
    return { episode, cardCount: 0, judgmentCards: [], error: countError.message };
  }

  return {
    episode,
    cardCount: count ?? 0,
    judgmentCards: (judgmentCards as JudgmentCardTitleRow[] | null) ?? [],
    error: null
  };
};

const buildEpisodeUrl = (episodeId: string): string => {
  const params = new URLSearchParams({
    utm_source: "twitter",
    utm_medium: "social",
    utm_campaign: "auto_post",
  });
  return `${SITE_URL}${buildPublicEpisodePath(episodeId)}?${params.toString()}`;
};

const buildOgImageUrl = (
  episode: LatestEpisodeRow,
  judgmentCards: JudgmentCardTitleRow[],
  cardCount: number
): string => {
  const params = new URLSearchParams();
  const title = resolveDisplayEpisodeTitle({
    title: episode.title,
    judgmentCards,
    fallback: ""
  });
  if (title) params.set("title", title);
  if (episode.genre) params.set("genre", episode.genre);
  if (cardCount > 0) params.set("cards", String(cardCount));
  if (episode.published_at) {
    const date = episode.published_at.slice(0, 10);
    params.set("date", date);
  }
  return `${SITE_URL}/api/og?${params.toString()}`;
};

const buildTweetText = (
  episode: LatestEpisodeRow,
  judgmentCards: JudgmentCardTitleRow[],
  cardCount: number,
  episodeUrl: string
): string => {
  const title = resolveDisplayEpisodeTitle({
    title: episode.title,
    judgmentCards,
    fallback: "新しいエピソード"
  });
  const description = episode.description ?? "";

  // Build the fixed parts first so we know how much room is left for the description
  const header = `\ud83c\udf99 ${title}`;
  const cardLine = cardCount > 0 ? `\n\n\ud83d\udccb \u30c8\u30d4\u30c3\u30af\u30ab\u30fc\u30c9 ${cardCount}\u4ef6` : "";
  const footer = `\n\n\ud83d\udd17 ${episodeUrl}\n\n${HASHTAGS}`;

  const fixedLength = header.length + cardLine.length + footer.length;

  // Add truncated description if there's room
  let descPart = "";
  if (description) {
    const availableForDesc = TWEET_MAX_LENGTH - fixedLength - 2; // 2 for "\n\n"
    if (availableForDesc > 20) {
      const truncated =
        description.length > availableForDesc
          ? description.slice(0, availableForDesc - 1) + "\u2026"
          : description;
      descPart = `\n\n${truncated}`;
    }
  }

  return `${header}${descPart}${cardLine}${footer}`;
};

const buildTweetPayload = async (): Promise<{
  tweet: string;
  episodeId: string;
  episodeTitle: string | null;
  ogImageUrl: string;
} | null> => {
  const { episode, cardCount, judgmentCards, error } = await fetchLatestJapaneseEpisode();
  if (error) {
    throw new Error(error);
  }

  if (!episode) {
    return null;
  }

  const episodeUrl = buildEpisodeUrl(episode.id);
  const ogImageUrl = buildOgImageUrl(episode, judgmentCards, cardCount);

  return {
    tweet: buildTweetText(episode, judgmentCards, cardCount, episodeUrl),
    episodeId: episode.id,
    episodeTitle: resolveDisplayEpisodeTitle({
      title: episode.title,
      judgmentCards,
      fallback: "新しいエピソード"
    }),
    ogImageUrl
  };
};

const verifyCronRequest = (request: Request): Response | null => {
  const cronAuth = verifyCronSecret(request);
  if (!cronAuth.ok) {
    return jsonResponse({ ok: false, error: cronAuth.error }, cronAuth.status);
  }

  return null;
};

export async function GET(request: Request) {
  const authError = verifyCronRequest(request);
  if (authError) return authError;

  try {
    const payload = await buildTweetPayload();
    if (!payload) {
      return jsonResponse({ ok: false, error: "no_published_episode_found" }, 404);
    }

    const publishStatus = resolveXAutoPostStatus();

    return jsonResponse({
      ok: true,
      ...payload,
      publishEnabled: publishStatus.enabled,
      publishConfigured: publishStatus.configured,
      missingKeys: publishStatus.missingKeys
    });
  } catch (err) {
    return jsonResponse(
      {
        ok: false,
        error: err instanceof Error ? err.message : "unexpected_error"
      },
      500
    );
  }
}

export async function POST(request: Request) {
  const authError = verifyCronRequest(request);
  if (authError) return authError;

  try {
    const payload = await buildTweetPayload();
    if (!payload) {
      return jsonResponse({ ok: false, error: "no_published_episode_found" }, 404);
    }

    const publishStatus = resolveXAutoPostStatus();
    if (!publishStatus.enabled) {
      return jsonResponse(
        {
          ok: false,
          error: "x_auto_post_disabled",
          missingKeys: publishStatus.missingKeys
        },
        503
      );
    }

    if (!publishStatus.configured) {
      return jsonResponse(
        {
          ok: false,
          error: "x_credentials_not_configured",
          missingKeys: publishStatus.missingKeys
        },
        503
      );
    }

    const published = await publishPostToX(payload.tweet);

    return jsonResponse({
      ok: true,
      ...payload,
      postId: published.id,
      postUrl: `https://x.com/i/web/status/${published.id}`
    });
  } catch (err) {
    return jsonResponse(
      {
        ok: false,
        error: err instanceof Error ? err.message : "unexpected_error"
      },
      500
    );
  }
}
