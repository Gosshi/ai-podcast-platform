const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 24 * 60 * 60 * 1000;
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

type ParsedDate = {
  year: number;
  month: number;
  day: number;
};

const parseDateString = (value: string): ParsedDate | null => {
  if (!DATE_PATTERN.test(value)) {
    return null;
  }

  const [yearRaw, monthRaw, dayRaw] = value.split("-");
  const year = Number.parseInt(yearRaw, 10);
  const month = Number.parseInt(monthRaw, 10);
  const day = Number.parseInt(dayRaw, 10);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return null;
  }
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }

  const timestamp = Date.UTC(year, month - 1, day);
  const date = new Date(timestamp);
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return { year, month, day };
};

const toUtcDateTimestamp = (value: string): number | null => {
  const parsed = parseDateString(value);
  if (!parsed) return null;
  return Date.UTC(parsed.year, parsed.month - 1, parsed.day);
};

const normalizeGenreKey = (value: string): string => {
  return value.trim().toLowerCase();
};

export const resolveGenerateIntervalDays = (
  rawValue: string | undefined,
  defaultValue = 2
): number => {
  const parsed = Number.parseInt(rawValue ?? "", 10);
  if (!Number.isFinite(parsed)) {
    return defaultValue;
  }
  return Math.max(1, Math.min(parsed, 365));
};

export const toJstDateString = (value: Date = new Date()): string => {
  const shifted = new Date(value.getTime() + JST_OFFSET_MS);
  const year = shifted.getUTCFullYear();
  const month = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const day = String(shifted.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const toJstDateStringFromIso = (isoTimestamp: string): string | null => {
  const parsed = new Date(isoTimestamp);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return toJstDateString(parsed);
};

export const diffEpisodeDatesInDays = (
  requestedEpisodeDate: string,
  lastEpisodeDate: string
): number | null => {
  const requestedAt = toUtcDateTimestamp(requestedEpisodeDate);
  const lastAt = toUtcDateTimestamp(lastEpisodeDate);
  if (requestedAt === null || lastAt === null) {
    return null;
  }
  return Math.floor((requestedAt - lastAt) / DAY_MS);
};

export const shouldSkipGenerationByInterval = (params: {
  requestedEpisodeDate: string;
  lastEpisodeDate: string | null;
  intervalDays: number;
  force: boolean;
}): boolean => {
  if (params.force) {
    return false;
  }
  if (!params.lastEpisodeDate) {
    return false;
  }

  const diffDays = diffEpisodeDatesInDays(params.requestedEpisodeDate, params.lastEpisodeDate);
  if (diffDays === null) {
    return false;
  }

  return diffDays < params.intervalDays;
};

export const shouldSkipGenerationByGenreInterval = (params: {
  requestedEpisodeDate: string;
  requestedGenre: string;
  lastEpisodeDateByGenre: Record<string, string | null | undefined>;
  intervalDays: number;
  force: boolean;
}): boolean => {
  const normalizedGenre = normalizeGenreKey(params.requestedGenre);
  const lastEpisodeDate = params.lastEpisodeDateByGenre[normalizedGenre] ?? null;

  return shouldSkipGenerationByInterval({
    requestedEpisodeDate: params.requestedEpisodeDate,
    lastEpisodeDate,
    intervalDays: params.intervalDays,
    force: params.force
  });
};
