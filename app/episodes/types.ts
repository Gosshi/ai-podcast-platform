import type { ViewerState } from "@/app/lib/viewer";
import type { JudgmentCard } from "@/src/lib/judgmentCards";

export type EpisodeLang = "ja" | "en";

export type EpisodeStatus = "draft" | "queued" | "generating" | "ready" | "published" | "failed";

export type EpisodeRow = {
  id: string;
  master_id: string | null;
  lang: EpisodeLang;
  genre: string | null;
  status: EpisodeStatus;
  title: string | null;
  description: string | null;
  preview_text: string | null;
  full_script: string | null;
  judgment_cards: JudgmentCard[];
  judgment_card_count: number;
  audio_url: string | null;
  published_at: string | null;
  created_at: string;
};

export type ViewLang = "all" | "ja" | "en";

export type EpisodesViewer = ViewerState | null;
