export type CanonicalTrendCategory =
  | "entertainment"
  | "game"
  | "movie"
  | "anime"
  | "culture"
  | "business"
  | "tech"
  | "policy"
  | "general";

const CATEGORY_ALIAS: Record<string, CanonicalTrendCategory> = {
  entertainment: "entertainment",
  streaming: "entertainment",
  celebrity: "entertainment",
  music: "entertainment",
  video: "entertainment",
  youtube: "entertainment",
  sports: "entertainment",
  game: "game",
  gaming: "game",
  esports: "game",
  movie: "movie",
  film: "movie",
  cinema: "movie",
  hollywood: "movie",
  anime: "anime",
  manga: "anime",
  culture: "culture",
  lifestyle: "culture",
  books: "culture",
  book: "culture",
  travel: "culture",
  food: "culture",
  tech: "tech",
  ai: "tech",
  startup: "tech",
  science: "tech",
  gadgets: "tech",
  policy: "policy",
  politics: "policy",
  government: "policy",
  election: "policy",
  world: "policy",
  news: "policy",
  crime: "policy",
  accident: "policy",
  disaster: "policy",
  war: "policy",
  business: "business",
  economy: "business",
  finance: "business",
  investment: "business",
  stocks: "business",
  stock: "business",
  crypto: "business",
  cryptocurrency: "business"
};

const RELIABLE_SOURCE_BONUS_BY_KEY: Record<string, number> = {
  animenewsnetwork: 0.2,
  ignall: 0.18,
  gamespotall: 0.18,
  variety: 0.16,
  hollywoodreporter: 0.16,
  gamer4gamer: 0.2,
  famitsu: 0.16,
  gamewatch: 0.16,
  oriconnews: 0.14,
  natalieall: 0.14,
  nataliemusic: 0.14,
  nataliecomic: 0.14,
  techcrunch: 0.08
};

const RELIABLE_SOURCE_BONUS_BY_NAME: Record<string, number> = {
  animenewsnetwork: 0.2,
  ign: 0.18,
  gamespot: 0.18,
  variety: 0.16,
  thehollywoodreporter: 0.16,
  "4gamer": 0.2,
  famitsu: 0.16,
  gamewatch: 0.16,
  oriconnews: 0.14,
  ナタリー総合: 0.14,
  ナタリー音楽: 0.14,
  ナタリーコミック: 0.14
};

export const REQUIRED_ENTERTAINMENT_CATEGORIES: CanonicalTrendCategory[] = [
  "entertainment",
  "game",
  "movie"
];

const normalizeToken = (value: string): string => value.trim().toLowerCase();

const toSourceKey = (value: string): string => {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, "");
};

export const normalizeTrendCategory = (
  value: string | null | undefined
): CanonicalTrendCategory => {
  const normalized = normalizeToken(value ?? "");
  if (!normalized) return "general";
  return CATEGORY_ALIAS[normalized] ?? "general";
};

export const isEntertainmentTrendCategory = (value: string | null | undefined): boolean => {
  const normalized = normalizeTrendCategory(value);
  return (
    normalized === "entertainment" ||
    normalized === "game" ||
    normalized === "movie" ||
    normalized === "anime" ||
    normalized === "culture"
  );
};

export const isHardTrendCategory = (value: string | null | undefined): boolean => {
  return normalizeTrendCategory(value) === "policy";
};

export const resolveSourceReliabilityBonus = (
  sourceKey: string | null | undefined,
  sourceName: string | null | undefined
): number => {
  const byKey = RELIABLE_SOURCE_BONUS_BY_KEY[toSourceKey(sourceKey ?? "")];
  if (typeof byKey === "number") return byKey;
  const byName = RELIABLE_SOURCE_BONUS_BY_NAME[toSourceKey(sourceName ?? "")];
  if (typeof byName === "number") return byName;
  return 0;
};
