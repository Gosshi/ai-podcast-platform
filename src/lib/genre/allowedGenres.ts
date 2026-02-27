export const DEFAULT_ALLOWED_GENRES = ["general", "entertainment", "tech"] as const;

export const normalizeGenre = (value: string): string => {
  return value.trim().toLowerCase();
};

export const resolveAllowedGenres = (
  rawValue: string | null | undefined,
  fallbackGenres: readonly string[] = DEFAULT_ALLOWED_GENRES
): string[] => {
  const parsed = (rawValue ?? "")
    .split(",")
    .map((entry) => normalizeGenre(entry))
    .filter((entry) => entry.length > 0);
  const base = parsed.length > 0 ? parsed : fallbackGenres.map((entry) => normalizeGenre(entry));
  const unique = Array.from(new Set(base));

  if (!unique.includes("general")) {
    unique.unshift("general");
  }

  return unique;
};

export const isGenreAllowed = (genre: string, allowedGenres: readonly string[]): boolean => {
  return allowedGenres.includes(normalizeGenre(genre));
};

