type TtsLang = "ja" | "en";

type SynthesizeEpisodeAudioInput = {
  episodeId: string;
  lang: TtsLang;
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
  errorType?: string;
  message?: string;
};

const DEFAULT_TTS_API_URL = "http://host.docker.internal:3000/api/tts";
const FALLBACK_TTS_API_URLS = [
  "http://172.17.0.1:3000/api/tts",
  "http://gateway.docker.internal:3000/api/tts"
];
export const TTS_API_TIMEOUT_MS = 45_000;

let cachedReachableTtsApiUrl: string | null = null;

export class TtsRequestError extends Error {
  readonly status: number;
  readonly errorType: string;
  readonly responsePayload: Record<string, unknown> | null;
  readonly apiUrl: string;

  constructor(params: {
    status: number;
    errorType: string;
    message: string;
    apiUrl: string;
    responsePayload?: Record<string, unknown> | null;
  }) {
    super(params.message);
    this.status = params.status;
    this.errorType = params.errorType;
    this.apiUrl = params.apiUrl;
    this.responsePayload = params.responsePayload ?? null;
  }
}

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

const hasExplicitApiUrl = (): boolean => {
  return Boolean(resolveConfiguredApiUrl() ?? resolveLegacyApiUrl());
};

const resolveApiUrlCandidates = (): string[] => {
  const configured = resolveConfiguredApiUrl();
  const legacy = resolveLegacyApiUrl();
  const candidates = (configured || legacy
    ? [cachedReachableTtsApiUrl, configured, legacy]
    : [cachedReachableTtsApiUrl, DEFAULT_TTS_API_URL, ...FALLBACK_TTS_API_URLS]
  ).filter((value): value is string => Boolean(value));
  return Array.from(new Set(candidates));
};

const normalizeApiError = (status: number, payload: TtsApiResponse): { errorType: string; message: string } => {
  const errorType =
    typeof payload.errorType === "string"
      ? payload.errorType
      : typeof payload.error === "string"
        ? payload.error
        : `tts_http_${status}`;

  const message =
    typeof payload.message === "string"
      ? payload.message
      : typeof payload.error === "string"
        ? payload.error
        : `tts request failed with status ${status}`;

  return { errorType, message };
};

const isClientError = (status: number): boolean => {
  return status >= 400 && status < 500 && status !== 408 && status !== 429;
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
          audioVersion: input.audioVersion
        }),
        signal: AbortSignal.timeout(TTS_API_TIMEOUT_MS)
      });

      const payload = (await response.json().catch(() => ({}))) as TtsApiResponse;
      if (!response.ok) {
        const { errorType, message } = normalizeApiError(response.status, payload);
        throw new TtsRequestError({
          status: response.status,
          errorType,
          message,
          apiUrl,
          responsePayload: payload as Record<string, unknown>
        });
      }

      if (payload.ok !== true || typeof payload.audioUrl !== "string") {
        throw new TtsRequestError({
          status: 502,
          errorType: "tts_invalid_response",
          message: "TTS API returned invalid response",
          apiUrl,
          responsePayload: payload as Record<string, unknown>
        });
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
      if (error instanceof TtsRequestError) {
        if (isClientError(error.status)) {
          throw error;
        }
        if (error.responsePayload && Object.keys(error.responsePayload).length > 0) {
          // Endpoint reached and returned structured JSON error; avoid duplicate synthesis retries.
          throw error;
        }
        lastError = error;
        continue;
      }

      if (
        (error instanceof DOMException && (error.name === "AbortError" || error.name === "TimeoutError")) ||
        (error instanceof Error && error.name === "AbortError")
      ) {
        lastError = new TtsRequestError({
          status: 504,
          errorType: "tts_api_timeout",
          message: `TTS API request timed out after ${TTS_API_TIMEOUT_MS}ms`,
          apiUrl
        });
        if (hasExplicitApiUrl()) {
          throw lastError;
        }
        continue;
      }

      const message = error instanceof Error ? error.message : String(error);
      lastError = new TtsRequestError({
        status: 502,
        errorType: "tts_api_request_failed",
        message,
        apiUrl
      });
    }
  }

  throw lastError ??
    new TtsRequestError({
      status: 502,
      errorType: "tts_request_failed",
      message: "No reachable TTS API endpoint",
      apiUrl: resolveApiUrlCandidates()[0] ?? DEFAULT_TTS_API_URL
    });
};
