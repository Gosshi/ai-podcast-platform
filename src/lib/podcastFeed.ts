import { DEFAULT_SITE_URL, PRODUCT_NAME, SITE_NAME } from "./brand.ts";
import { buildPublicEpisodePath } from "./episodeLinks.ts";

export const PODCAST_FEED_SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? DEFAULT_SITE_URL;
export const PODCAST_FEED_TITLE = SITE_NAME;
export const PODCAST_FEED_DESCRIPTION =
  "AIが毎朝ポッドキャストを自動生成。通勤中に聴くだけで、サブスク・買い物・エンタメの判断が整理される。";
export const PODCAST_FEED_AUTHOR = PRODUCT_NAME;
export const PODCAST_FEED_EMAIL =
  process.env.PODCAST_FEED_OWNER_EMAIL?.trim() || "hello@signal-move.com";
export const PODCAST_FEED_CATEGORY =
  process.env.PODCAST_FEED_CATEGORY?.trim() || "Technology";
export const PODCAST_FEED_SUBTITLE =
  process.env.PODCAST_FEED_SUBTITLE?.trim() || "聴くだけで、判断が整理される。";
export const PODCAST_FEED_IMAGE = `${PODCAST_FEED_SITE_URL}/api/og/cover`;

export type PodcastFeedEpisode = {
  id: string;
  title: string | null;
  description: string | null;
  audioUrl: string | null;
  durationSec: number | null;
  publishedAt: string | null;
  genre: string | null;
};

const PODCAST_COMPATIBLE_AUDIO_EXTENSIONS = new Set(["mp3", "aac", "m4a"]);

export const escapeXml = (value: string): string => {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
};

export const formatRfc822 = (dateStr: string): string => {
  return new Date(dateStr).toUTCString();
};

export const formatDuration = (seconds: number | null): string => {
  if (!seconds || seconds <= 0) return "00:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

export const resolveAudioContentType = (audioUrl: string): string => {
  const normalized = audioUrl.toLowerCase();

  if (normalized.endsWith(".mp3")) return "audio/mpeg";
  if (normalized.endsWith(".aac") || normalized.endsWith(".m4a")) return "audio/aac";
  if (normalized.endsWith(".opus")) return "audio/ogg";
  if (normalized.endsWith(".flac")) return "audio/flac";
  if (normalized.endsWith(".wav")) return "audio/wav";

  return "audio/mpeg";
};

export const resolveAudioExtension = (audioUrl: string | null): string | null => {
  const value = audioUrl?.trim();
  if (!value) return null;

  try {
    const normalized = new URL(value, PODCAST_FEED_SITE_URL).pathname.toLowerCase();
    const match = normalized.match(/\.([a-z0-9]+)$/);
    return match?.[1] ?? null;
  } catch {
    const normalized = value.toLowerCase().split("?")[0]?.split("#")[0] ?? "";
    const match = normalized.match(/\.([a-z0-9]+)$/);
    return match?.[1] ?? null;
  }
};

export const isPodcastCompatibleAudioUrl = (audioUrl: string | null): boolean => {
  const extension = resolveAudioExtension(audioUrl);
  return extension ? PODCAST_COMPATIBLE_AUDIO_EXTENSIONS.has(extension) : false;
};

const resolveEpisodeUrl = (episodeId: string): string => {
  return `${PODCAST_FEED_SITE_URL}${buildPublicEpisodePath(episodeId)}`;
};

const buildItemXml = (episode: PodcastFeedEpisode): string => {
  const audioUrl = episode.audioUrl ?? "";
  const fullAudioUrl = audioUrl.startsWith("http")
    ? audioUrl
    : `${PODCAST_FEED_SITE_URL}${audioUrl}`;

  return `
    <item>
      <title>${escapeXml(episode.title ?? "")}</title>
      <description><![CDATA[${episode.description ?? ""}]]></description>
      <itunes:summary><![CDATA[${episode.description ?? ""}]]></itunes:summary>
      <link>${resolveEpisodeUrl(episode.id)}</link>
      <guid isPermaLink="false">${episode.id}</guid>
      <pubDate>${episode.publishedAt ? formatRfc822(episode.publishedAt) : ""}</pubDate>
      <enclosure url="${escapeXml(fullAudioUrl)}" length="0" type="${resolveAudioContentType(fullAudioUrl)}" />
      <itunes:duration>${formatDuration(episode.durationSec)}</itunes:duration>
      <itunes:explicit>false</itunes:explicit>
      <itunes:episodeType>full</itunes:episodeType>
      ${episode.genre ? `<itunes:keywords>${escapeXml(episode.genre)}</itunes:keywords>` : ""}
    </item>`;
};

export const buildPodcastFeedXml = (episodes: PodcastFeedEpisode[]): string => {
  const itemsXml = episodes.map((episode) => buildItemXml(episode)).join("\n");
  const lastBuildDate =
    episodes.find((episode) => episode.publishedAt)?.publishedAt ?? new Date().toISOString();

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
  xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"
  xmlns:content="http://purl.org/rss/1.0/modules/content/"
  xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(PODCAST_FEED_TITLE)}</title>
    <description><![CDATA[${PODCAST_FEED_DESCRIPTION}]]></description>
    <link>${PODCAST_FEED_SITE_URL}</link>
    <language>ja</language>
    <lastBuildDate>${formatRfc822(lastBuildDate)}</lastBuildDate>
    <generator>Next.js</generator>
    <atom:link href="${PODCAST_FEED_SITE_URL}/feed.xml" rel="self" type="application/rss+xml" />
    <itunes:author>${escapeXml(PODCAST_FEED_AUTHOR)}</itunes:author>
    <itunes:owner>
      <itunes:name>${escapeXml(PODCAST_FEED_AUTHOR)}</itunes:name>
      <itunes:email>${escapeXml(PODCAST_FEED_EMAIL)}</itunes:email>
    </itunes:owner>
    <itunes:summary><![CDATA[${PODCAST_FEED_DESCRIPTION}]]></itunes:summary>
    <itunes:subtitle>${escapeXml(PODCAST_FEED_SUBTITLE)}</itunes:subtitle>
    <itunes:type>episodic</itunes:type>
    <itunes:category text="${escapeXml(PODCAST_FEED_CATEGORY)}" />
    <itunes:explicit>false</itunes:explicit>
    <itunes:image href="${PODCAST_FEED_IMAGE}" />
    <image>
      <url>${PODCAST_FEED_IMAGE}</url>
      <title>${escapeXml(PODCAST_FEED_TITLE)}</title>
      <link>${PODCAST_FEED_SITE_URL}</link>
    </image>
    ${itemsXml}
  </channel>
</rss>`;
};
