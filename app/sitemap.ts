import type { MetadataRoute } from "next";
import { createServiceRoleClient } from "@/app/lib/supabaseClients";
import { DEFAULT_SITE_URL } from "@/src/lib/brand";
import { buildPublicEpisodePath } from "@/src/lib/episodeLinks";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? DEFAULT_SITE_URL;

const buildStaticEntries = (): MetadataRoute.Sitemap => [
  {
    url: SITE_URL,
    lastModified: new Date(),
    changeFrequency: "daily",
    priority: 1
  },
  {
    url: `${SITE_URL}/episodes`,
    lastModified: new Date(),
    changeFrequency: "daily",
    priority: 0.9
  },
  {
    url: `${SITE_URL}/guide`,
    lastModified: new Date(),
    changeFrequency: "monthly",
    priority: 0.5
  },
  {
    url: `${SITE_URL}/commercial-disclosure`,
    lastModified: new Date(),
    changeFrequency: "monthly",
    priority: 0.2
  },
  {
    url: `${SITE_URL}/terms`,
    lastModified: new Date(),
    changeFrequency: "monthly",
    priority: 0.2
  },
  {
    url: `${SITE_URL}/privacy`,
    lastModified: new Date(),
    changeFrequency: "monthly",
    priority: 0.2
  }
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticEntries = buildStaticEntries();
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return staticEntries;
  }

  const supabase = createServiceRoleClient();
  const { data } = await supabase
    .from("episodes")
    .select("id, published_at")
    .eq("status", "published")
    .eq("lang", "ja")
    .not("published_at", "is", null)
    .order("published_at", { ascending: false })
    .limit(100);

  const episodeEntries = ((data as Array<{ id: string; published_at: string | null }> | null) ?? [])
    .filter((episode) => episode.published_at)
    .map((episode) => ({
      url: `${SITE_URL}${buildPublicEpisodePath(episode.id)}`,
      lastModified: episode.published_at ?? undefined,
      changeFrequency: "weekly" as const,
      priority: 0.8
    }));

  return [...staticEntries, ...episodeEntries];
}
