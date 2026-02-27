import { toJstDateString } from "./dailyGenerateInterval.ts";
import { normalizeGenre } from "../../../src/lib/genre/allowedGenres.ts";

const EPISODE_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
};

const isValidEpisodeDate = (value: string): boolean => {
  if (!EPISODE_DATE_PATTERN.test(value)) {
    return false;
  }

  const [yearRaw, monthRaw, dayRaw] = value.split("-");
  const year = Number.parseInt(yearRaw, 10);
  const month = Number.parseInt(monthRaw, 10);
  const day = Number.parseInt(dayRaw, 10);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
};

export type DailyGenerateRequestEcho = {
  episodeDate: string;
  genre: string;
  force: boolean;
};

export type ParseDailyGenerateRequestResult =
  | {
      ok: true;
      episodeDate: string;
      genre: string;
      force: boolean;
      requestEcho: DailyGenerateRequestEcho;
    }
  | {
      ok: false;
      status: 400;
      error: "validation_error";
      message: string;
      requestEcho: DailyGenerateRequestEcho;
    };

export const parseDailyGenerateRequest = (
  body: unknown,
  now: Date = new Date()
): ParseDailyGenerateRequestResult => {
  const record = isRecord(body) ? body : {};
  const defaultEpisodeDate = toJstDateString(now);

  const episodeDateRaw = record.episodeDate;
  const genreRaw = record.genre;
  const forceRaw = record.force;

  const episodeDate = typeof episodeDateRaw === "string" ? episodeDateRaw : defaultEpisodeDate;
  const genre =
    typeof genreRaw === "string" ? normalizeGenre(genreRaw) || "general" : "general";
  const force = typeof forceRaw === "boolean" ? forceRaw : false;
  const requestEcho: DailyGenerateRequestEcho = {
    episodeDate,
    genre,
    force
  };

  if (episodeDateRaw !== undefined && typeof episodeDateRaw !== "string") {
    return {
      ok: false,
      status: 400,
      error: "validation_error",
      message: "episodeDate must be a string in YYYY-MM-DD format",
      requestEcho
    };
  }

  if (!isValidEpisodeDate(episodeDate)) {
    return {
      ok: false,
      status: 400,
      error: "validation_error",
      message: "episodeDate must be a valid date in YYYY-MM-DD format",
      requestEcho
    };
  }

  if (genreRaw !== undefined && typeof genreRaw !== "string") {
    return {
      ok: false,
      status: 400,
      error: "validation_error",
      message: "genre must be a string",
      requestEcho
    };
  }

  if (forceRaw !== undefined && typeof forceRaw !== "boolean") {
    return {
      ok: false,
      status: 400,
      error: "validation_error",
      message: "force must be a boolean",
      requestEcho
    };
  }

  return {
    ok: true,
    episodeDate,
    genre,
    force,
    requestEcho
  };
};
