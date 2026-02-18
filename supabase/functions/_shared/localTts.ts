type TtsLang = "ja" | "en";

type SynthesizeEpisodeAudioInput = {
  episodeId: string;
  lang: TtsLang;
  text: string;
  audioVersion?: string;
};

type TtsApiResponse = {
  ok?: boolean;
  audioUrl?: string;
  durationSec?: number;
  provider?: string;
  requestedProvider?: string;
  model?: string | null;
  voice?: string | null;
  format?: string;
  fallbackReason?: string | null;
  error?: string;
};

const DEFAULT_TTS_API_URL = "http://host.docker.internal:3000/api/tts";
const FALLBACK_TTS_API_URLS = [
  "http://172.17.0.1:3000/api/tts",
  "http://gateway.docker.internal:3000/api/tts"
];

let cachedReachableTtsApiUrl: string | null = null;

const normalizeAbsoluteUrl = (raw: string | null | undefined): URL | null => {
  const value = raw?.trim();
  if (!value) {
    return null;
  }

  try {
    return new URL(value);
  } catch {
    return null;
  }
};

const resolvePath = (): string => {
  const raw = Deno.env.get("TTS_API_PATH") ?? Deno.env.get("LOCAL_TTS_PATH") ?? "/api/tts";
  return raw.startsWith("/") ? raw : `/${raw}`;
};

const normalizeApiUrl = (raw: string | null | undefined, fallbackPath: string): string | null => {
  const url = normalizeAbsoluteUrl(raw);
  if (!url) {
    return null;
  }

  if (url.pathname === "/" || !url.pathname) {
    url.pathname = fallbackPath;
  }
  if (url.pathname.length > 1) {
    url.pathname = url.pathname.replace(/\/+$/, "");
  }
  return url.toString();
};

const resolveConfiguredApiUrl = (): string | null => {
  return normalizeApiUrl(
    Deno.env.get("TTS_API_URL") ?? Deno.env.get("TTS_LOCAL_API_URL"),
    resolvePath()
  );
};

const resolveLegacyApiUrl = (): string | null => {
  const configuredBaseUrl =
    Deno.env.get("LOCAL_TTS_BASE_URL") ??
    Deno.env.get("APP_BASE_URL") ??
    Deno.env.get("NEXT_PUBLIC_APP_URL");
  const baseUrl = normalizeAbsoluteUrl(configuredBaseUrl);
  if (!baseUrl) {
    return null;
  }
  baseUrl.pathname = resolvePath();
  return baseUrl.toString();
};

const resolveApiUrlCandidates = (): string[] => {
  const candidates = [
    cachedReachableTtsApiUrl,
    resolveConfiguredApiUrl(),
    resolveLegacyApiUrl(),
    DEFAULT_TTS_API_URL,
    ...FALLBACK_TTS_API_URLS
  ].filter((value): value is string => Boolean(value));
  return Array.from(new Set(candidates));
};

const resolveErrorMessage = (status: number, payload: TtsApiResponse): string => {
  if (payload.error) {
    return payload.error;
  }
  return `tts_http_${status}`;
};

export const synthesizeEpisodeAudio = async (
  input: SynthesizeEpisodeAudioInput
): Promise<{
  audioUrl: string;
  durationSec: number;
  provider: string;
  requestedProvider: string;
  model: string | null;
  voice: string | null;
  format: string | null;
  fallbackReason: string | null;
}> => {
  const script = input.text.trim();
  if (!script) {
    throw new Error("episode script is empty");
  }

  const localTtsApiKey = Deno.env.get("LOCAL_TTS_API_KEY");
  let lastError: Error | null = null;

  for (const apiUrl of resolveApiUrlCandidates()) {
    try {
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(localTtsApiKey ? { "x-local-tts-api-key": localTtsApiKey } : {})
        },
        body: JSON.stringify({
          episodeId: input.episodeId,
          lang: input.lang,
          text: script,
          audioVersion: input.audioVersion
        })
      });

      const payload = (await response.json().catch(() => ({}))) as TtsApiResponse;
      if (!response.ok || payload.ok !== true || typeof payload.audioUrl !== "string") {
        throw new Error(resolveErrorMessage(response.status, payload));
      }

      cachedReachableTtsApiUrl = apiUrl;
      return {
        audioUrl: payload.audioUrl,
        durationSec: typeof payload.durationSec === "number" ? payload.durationSec : 120,
        provider: typeof payload.provider === "string" ? payload.provider : "local",
        requestedProvider:
          typeof payload.requestedProvider === "string"
            ? payload.requestedProvider
            : typeof payload.provider === "string"
              ? payload.provider
              : "local",
        model: typeof payload.model === "string" ? payload.model : null,
        voice: typeof payload.voice === "string" ? payload.voice : null,
        format: typeof payload.format === "string" ? payload.format : null,
        fallbackReason: typeof payload.fallbackReason === "string" ? payload.fallbackReason : null
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }

  throw lastError ?? new Error("tts_request_failed");
};
