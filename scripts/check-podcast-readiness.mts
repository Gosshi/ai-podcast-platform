import { createClient } from "@supabase/supabase-js";
import { isPodcastCompatibleAudioUrl } from "../src/lib/podcastFeed.ts";

type EpisodeRow = {
  id: string;
  title: string | null;
  audio_url: string | null;
  published_at: string | null;
  status: string | null;
  lang: string | null;
};

const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const { data, error } = await supabase
  .from("episodes")
  .select("id, title, audio_url, published_at, status, lang")
  .eq("status", "published")
  .eq("lang", "ja")
  .order("published_at", { ascending: false, nullsFirst: false })
  .limit(20);

if (error) {
  console.error(`Failed to load episodes: ${error.message}`);
  process.exit(1);
}

const episodes = ((data as EpisodeRow[] | null) ?? []).filter((episode) => Boolean(episode.published_at));
const compatible = episodes.filter((episode) => isPodcastCompatibleAudioUrl(episode.audio_url));
const incompatible = episodes.filter((episode) => episode.audio_url && !isPodcastCompatibleAudioUrl(episode.audio_url));
const missingAudio = episodes.filter((episode) => !episode.audio_url);

console.log("Podcast readiness");
console.log(`- published ja episodes: ${episodes.length}`);
console.log(`- compatible feed items (mp3/aac/m4a): ${compatible.length}`);
console.log(`- incompatible audio urls: ${incompatible.length}`);
console.log(`- missing audio_url: ${missingAudio.length}`);

if (compatible.length > 0) {
  console.log("");
  console.log("Compatible items");
  for (const episode of compatible.slice(0, 5)) {
    console.log(`- ${episode.id} | ${episode.published_at} | ${episode.audio_url}`);
  }
}

if (incompatible.length > 0) {
  console.log("");
  console.log("Incompatible audio urls");
  for (const episode of incompatible.slice(0, 5)) {
    console.log(`- ${episode.id} | ${episode.published_at} | ${episode.audio_url}`);
  }
}

if (missingAudio.length > 0) {
  console.log("");
  console.log("Missing audio_url");
  for (const episode of missingAudio.slice(0, 5)) {
    console.log(`- ${episode.id} | ${episode.published_at} | ${episode.title ?? "(untitled)"}`);
  }
}

if (compatible.length === 0) {
  console.error("");
  console.error("No podcast-compatible published episodes found.");
  process.exit(1);
}
