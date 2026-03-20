import { createServiceRoleClient } from "@/app/lib/supabaseClients";
import { DEFAULT_SITE_URL, PRODUCT_NAME, SITE_NAME } from "@/src/lib/brand";

export const dynamic = "force-dynamic";
export const revalidate = 3600; // Cache for 1 hour

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? DEFAULT_SITE_URL;
const PODCAST_TITLE = SITE_NAME;
const PODCAST_DESCRIPTION =
  "AIが毎朝ポッドキャストを自動生成。通勤中に聴くだけで、サブスク・買い物・エンタメの判断が整理される。";
const PODCAST_LANGUAGE = "ja";
const PODCAST_AUTHOR = PRODUCT_NAME;
const PODCAST_EMAIL = "hello@signal-move.com";
const PODCAST_CATEGORY = "Technology";
const PODCAST_IMAGE = `${SITE_URL}/api/og/cover`;

const escapeXml = (value: string): string => {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
};

const formatRfc822 = (dateStr: string): string => {
  const date = new Date(dateStr);
  return date.toUTCString();
};

const formatDuration = (seconds: number | null): string => {
  if (!seconds || seconds <= 0) return "00:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

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

  const items = (episodes as EpisodeRow[] | null) ?? [];

  const itemsXml = items
    .map((ep) => {
      const audioUrl = ep.audio_url ?? "";
      const fullAudioUrl = audioUrl.startsWith("http") ? audioUrl : `${SITE_URL}${audioUrl}`;
      const episodeUrl = `${SITE_URL}/decisions/${ep.id}`;
      return `
    <item>
      <title>${escapeXml(ep.title ?? "")}</title>
      <description><![CDATA[${ep.description ?? ""}]]></description>
      <link>${episodeUrl}</link>
      <guid isPermaLink="false">${ep.id}</guid>
      <pubDate>${ep.published_at ? formatRfc822(ep.published_at) : ""}</pubDate>
      <enclosure url="${escapeXml(fullAudioUrl)}" type="audio/wav" />
      <itunes:duration>${formatDuration(ep.duration_sec)}</itunes:duration>
      <itunes:explicit>false</itunes:explicit>
      ${ep.genre ? `<itunes:keywords>${escapeXml(ep.genre)}</itunes:keywords>` : ""}
    </item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
  xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"
  xmlns:content="http://purl.org/rss/1.0/modules/content/"
  xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(PODCAST_TITLE)}</title>
    <description><![CDATA[${PODCAST_DESCRIPTION}]]></description>
    <link>${SITE_URL}</link>
    <language>${PODCAST_LANGUAGE}</language>
    <atom:link href="${SITE_URL}/feed.xml" rel="self" type="application/rss+xml" />
    <itunes:author>${escapeXml(PODCAST_AUTHOR)}</itunes:author>
    <itunes:owner>
      <itunes:name>${escapeXml(PODCAST_AUTHOR)}</itunes:name>
      <itunes:email>${PODCAST_EMAIL}</itunes:email>
    </itunes:owner>
    <itunes:category text="${PODCAST_CATEGORY}" />
    <itunes:explicit>false</itunes:explicit>
    <itunes:image href="${PODCAST_IMAGE}" />
    <image>
      <url>${PODCAST_IMAGE}</url>
      <title>${escapeXml(PODCAST_TITLE)}</title>
      <link>${SITE_URL}</link>
    </image>
    ${itemsXml}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600"
    }
  });
}
