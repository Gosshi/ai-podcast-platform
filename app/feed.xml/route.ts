import { createServiceRoleClient } from "@/app/lib/supabaseClients";
import { buildPodcastFeedXml, isPodcastCompatibleAudioUrl } from "@/src/lib/podcastFeed";

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
  const xml = buildPodcastFeedXml(
    items.map((ep) => ({
      id: ep.id,
      title: ep.title,
      description: ep.description,
      audioUrl: ep.audio_url,
      durationSec: ep.duration_sec,
      publishedAt: ep.published_at,
      genre: ep.genre
    }))
  );

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600"
    }
  });
}
