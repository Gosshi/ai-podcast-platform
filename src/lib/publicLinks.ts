import { DEFAULT_SITE_URL } from "./brand";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL?.trim() || DEFAULT_SITE_URL;

export const APPLE_PODCASTS_SHOW_URL =
  "https://podcasts.apple.com/jp/podcast/%E5%88%A4%E6%96%AD%E3%81%AE%E3%81%98%E3%81%8B%E3%82%93-by-signalmove/id1887020163";
export const SPOTIFY_SHOW_URL = "https://open.spotify.com/show/6nswsdY9ScaOvaLBkeKsFH";
export const X_PROFILE_URL = "https://x.com/signalmove_jp";
export const PUBLIC_EPISODES_URL = `${SITE_URL}/episodes`;
