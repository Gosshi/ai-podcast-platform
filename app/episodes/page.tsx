import { loadPublishedEpisodes } from "@/app/lib/episodes";
import { getViewerFromCookies } from "@/app/lib/viewer";
import { resolveLocale } from "@/src/lib/i18n/locale";
import {
  isGenreAllowed,
  normalizeGenre,
  resolveAllowedGenres
} from "@/src/lib/genre/allowedGenres";
import type { Metadata } from "next";
import EpisodesView from "./EpisodesView";
import type { ViewLang } from "./types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "エピソード一覧",
  description:
    "テクノロジー・ゲーム・配信・アニメ・映画。ジャンル別にAI生成ポッドキャストを一覧で探せます。",
  openGraph: {
    title: "エピソード一覧 | 判断のじかん",
    description: "ジャンル別にAI生成ポッドキャストを一覧で探せます。"
  }
};

type SearchParams = {
  lang?: string | string[];
  filter?: string | string[];
  genre?: string | string[];
};

const readFirstParam = (value: string | string[] | undefined): string | undefined => {
  if (Array.isArray(value)) return value[0];
  return value;
};

const resolveViewLang = (value: string | undefined): ViewLang => {
  if (value === "ja" || value === "en") return value;
  return "all";
};

const resolveGenreFilter = (value: string | undefined): string | null => {
  if (!value) return null;
  const normalized = normalizeGenre(value);
  if (!normalized) return null;

  const allowedGenres = resolveAllowedGenres(process.env.ALLOWED_GENRES);
  return isGenreAllowed(normalized, allowedGenres) ? normalized : null;
};

export default async function EpisodesPage({
  searchParams
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const locale = resolveLocale(readFirstParam(params.lang));
  const initialViewLang = resolveViewLang(readFirstParam(params.filter));
  const genreFilter = resolveGenreFilter(readFirstParam(params.genre));
  const viewer = await getViewerFromCookies();
  const { episodes, error } = await loadPublishedEpisodes({
    genreFilter,
    isPaid: viewer?.isPaid ?? false
  });

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://handan-no-jikan.com";

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "PodcastSeries",
    name: "判断のじかん",
    description:
      "AIが毎朝ポッドキャストを自動生成。通勤中に聴くだけで、サブスク・買い物・エンタメの判断が整理される。",
    url: `${siteUrl}/episodes`,
    inLanguage: "ja",
    genre: ["テクノロジー", "ゲーム", "配信", "アニメ", "映画"],
    webFeed: `${siteUrl}/episodes`,
    author: {
      "@type": "Organization",
      name: "判断のじかん"
    }
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <EpisodesView
        episodes={episodes}
        initialLocale={locale}
        initialViewLang={initialViewLang}
        loadError={error}
        viewer={viewer}
      />
    </>
  );
}
