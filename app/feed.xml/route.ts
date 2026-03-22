import { createServiceRoleClient } from "@/app/lib/supabaseClients";
import {
  buildPodcastFeedXml,
  isPodcastCompatibleAudioUrl,
  resolveAbsoluteAudioUrl
} from "@/src/lib/podcastFeed";

export const dynamic = "force-dynamic";
export const revalidate = 3600; // Cache for 1 hour

type EpisodeRow = {
  id: string;
  title: string | null;
  description: string | null;
  audio_url: string | null;
  duration_sec: number | null;
  published_at: string | null;
  genre: string | null;
  lang: "ja" | "en";
};

type JudgmentCardRow = {
  episode_id: string;
  topic_order: number;
  topic_title: string;
};

const AUDIO_HEAD_TIMEOUT_MS = 5_000;

const parseContentLength = (value: string | null): number | null => {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
};

const parseContentRangeTotal = (value: string | null): number | null => {
  if (!value) return null;
  const match = value.match(/\/(\d+)$/);
  if (!match) return null;
  const parsed = Number.parseInt(match[1], 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
};

const resolveAudioLengthBytes = async (audioUrl: string | null): Promise<number | null> => {
  const absoluteAudioUrl = resolveAbsoluteAudioUrl(audioUrl);
  if (!absoluteAudioUrl) return null;

  try {
    const headResponse = await fetch(absoluteAudioUrl, {
      method: "HEAD",
      cache: "no-store",
      signal: AbortSignal.timeout(AUDIO_HEAD_TIMEOUT_MS)
    });
    const headLength = parseContentLength(headResponse.headers.get("content-length"));
    if (headLength) {
      return headLength;
    }
  } catch {
    // Fall through to the range request below.
  }

  try {
    const rangeResponse = await fetch(absoluteAudioUrl, {
      method: "GET",
      cache: "no-store",
      headers: {
        Range: "bytes=0-0"
      },
      signal: AbortSignal.timeout(AUDIO_HEAD_TIMEOUT_MS)
    });
    return (
      parseContentRangeTotal(rangeResponse.headers.get("content-range")) ??
      parseContentLength(rangeResponse.headers.get("content-length"))
    );
  } catch {
    return null;
  }
};

export async function GET(): Promise<Response> {
  const supabase = createServiceRoleClient();
  const { data: episodes, error } = await supabase
    .from("episodes")
    .select("id, title, description, audio_url, duration_sec, published_at, genre, lang")
    .eq("status", "published")
    .eq("lang", "ja")
    .not("audio_url", "is", null)
    .not("published_at", "is", null)
    .order("published_at", { ascending: false })
    .limit(50);

  if (error) {
    return new Response("Internal Server Error", { status: 500 });
  }

  const items = ((episodes as EpisodeRow[] | null) ?? []).filter((episode) =>
    isPodcastCompatibleAudioUrl(episode.audio_url)
  );
  const episodeIds = items.map((episode) => episode.id);
  const { data: judgmentCards } =
    episodeIds.length === 0
      ? { data: [] as JudgmentCardRow[] }
      : await supabase
          .from("episode_judgment_cards")
          .select("episode_id, topic_order, topic_title")
          .in("episode_id", episodeIds)
          .order("topic_order", { ascending: true });
  const judgmentCardsByEpisode = ((judgmentCards as JudgmentCardRow[] | null) ?? []).reduce(
    (map, card) => {
      const cards = map.get(card.episode_id) ?? [];
      cards.push(card);
      map.set(card.episode_id, cards);
      return map;
    },
    new Map<string, JudgmentCardRow[]>()
  );
  const feedEpisodes = await Promise.all(
    items.map(async (ep) => ({
      id: ep.id,
      title: ep.title,
      description: ep.description,
      audioUrl: ep.audio_url,
      audioLengthBytes: await resolveAudioLengthBytes(ep.audio_url),
      durationSec: ep.duration_sec,
      publishedAt: ep.published_at,
      genre: ep.genre,
      judgmentCards: judgmentCardsByEpisode.get(ep.id) ?? []
    }))
  );
  const xml = buildPodcastFeedXml(feedEpisodes);

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600"
    }
  });
}
