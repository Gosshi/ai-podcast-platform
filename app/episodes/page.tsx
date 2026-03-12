import { loadPublishedEpisodes } from "@/app/lib/episodes";
import { getViewerFromCookies } from "@/app/lib/viewer";
import { resolveLocale } from "@/src/lib/i18n/locale";
import {
  isGenreAllowed,
  normalizeGenre,
  resolveAllowedGenres
} from "@/src/lib/genre/allowedGenres";
import EpisodesView from "./EpisodesView";
import type { ViewLang } from "./types";

export const dynamic = "force-dynamic";

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

  return (
    <EpisodesView
      episodes={episodes}
      initialLocale={locale}
      initialViewLang={initialViewLang}
      loadError={error}
      viewer={viewer}
    />
  );
}
