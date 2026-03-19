export const runtime = "nodejs";

import { jsonResponse } from "@/app/lib/apiResponse";
import { verifyCronSecret } from "@/app/lib/cronAuth";
import { createServiceRoleClient } from "@/app/lib/supabaseClients";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://handan-no-jikan.com";

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

const fetchLatestJapaneseEpisode = async (): Promise<{
  episode: LatestEpisodeRow | null;
  cardCount: number;
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
    return { episode: null, cardCount: 0, error: error.message };
  }

  const episode = data as LatestEpisodeRow | null;
  if (!episode) {
    return { episode: null, cardCount: 0, error: null };
  }

  // Count judgment cards for this episode
  const { count, error: countError } = await supabase
    .from("episode_judgment_cards")
    .select("id", { count: "exact", head: true })
    .eq("episode_id", episode.id);

  if (countError) {
    return { episode, cardCount: 0, error: countError.message };
  }

  return { episode, cardCount: count ?? 0, error: null };
};

const buildEpisodeUrl = (episodeId: string): string => {
  const params = new URLSearchParams({
    utm_source: "twitter",
    utm_medium: "social",
    utm_campaign: "auto_post",
  });
  return `${SITE_URL}/episodes/${episodeId}?${params.toString()}`;
};

const buildOgImageUrl = (episode: LatestEpisodeRow, cardCount: number): string => {
  const params = new URLSearchParams();
  if (episode.title) params.set("title", episode.title);
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
  cardCount: number,
  episodeUrl: string
): string => {
  const title = episode.title ?? "新しいエピソード";
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

export async function GET(request: Request) {
  const cronAuth = verifyCronSecret(request);
  if (!cronAuth.ok) {
    return jsonResponse({ ok: false, error: cronAuth.error }, cronAuth.status);
  }

  try {
    const { episode, cardCount, error } = await fetchLatestJapaneseEpisode();

    if (error) {
      return jsonResponse({ ok: false, error }, 500);
    }

    if (!episode) {
      return jsonResponse(
        { ok: false, error: "no_published_episode_found" },
        404
      );
    }

    const episodeUrl = buildEpisodeUrl(episode.id);
    const ogImageUrl = buildOgImageUrl(episode, cardCount);
    const tweet = buildTweetText(episode, cardCount, episodeUrl);

    return jsonResponse({
      ok: true,
      tweet,
      episodeId: episode.id,
      episodeTitle: episode.title,
      ogImageUrl,
    });
  } catch (err) {
    return jsonResponse(
      {
        ok: false,
        error: err instanceof Error ? err.message : "unexpected_error",
      },
      500
    );
  }
}
