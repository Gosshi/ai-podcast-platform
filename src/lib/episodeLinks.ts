import { DEFAULT_SITE_URL } from "./brand.ts";

export const EPISODE_PUBLIC_BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? DEFAULT_SITE_URL;

export const buildPublicEpisodePath = (episodeId: string): string => {
  return `/episodes/${episodeId}`;
};

export const buildPublicEpisodeUrl = (episodeId: string, siteUrl = EPISODE_PUBLIC_BASE_URL): string => {
  return `${siteUrl}${buildPublicEpisodePath(episodeId)}`;
};
