export type EpisodeLang = "ja" | "en";

export type EpisodeStatus = "draft" | "queued" | "generating" | "ready" | "published" | "failed";

export type EpisodeRow = {
  id: string;
  master_id: string | null;
  lang: EpisodeLang;
  status: EpisodeStatus;
  title: string | null;
  script: string | null;
  script_polished: string | null;
  script_polished_preview: string | null;
  audio_url: string | null;
  published_at: string | null;
  created_at: string;
};

export type JobRunRow = {
  id: string;
  job_type: string;
  status: "failed";
  payload: unknown;
  error: string | null;
  started_at: string;
};

export type ViewLang = "all" | "ja" | "en";
