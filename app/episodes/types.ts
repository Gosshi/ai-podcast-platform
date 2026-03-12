import type { PublishedEpisodeRow } from "@/app/lib/episodes";
import type { ViewerState } from "@/app/lib/viewer";

export type EpisodeLang = "ja" | "en";

export type EpisodeStatus = "draft" | "queued" | "generating" | "ready" | "published" | "failed";

export type EpisodeRow = PublishedEpisodeRow;

export type ViewLang = "all" | "ja" | "en";

export type EpisodesViewer = ViewerState | null;
