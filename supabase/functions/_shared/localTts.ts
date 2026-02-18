type LocalTtsLang = "ja" | "en";

type SynthesizeLocalAudioInput = {
  episodeId: string;
  lang: LocalTtsLang;
  text: string;
  audioVersion?: string;
};

type LocalTtsResponse = {
  ok?: boolean;
  audioUrl?: string;
  durationSec?: number;
  error?: string;
};

const resolveConfiguredBaseUrl = (): string | null => {
  const explicit =
    Deno.env.get("LOCAL_TTS_BASE_URL") ??
    Deno.env.get("APP_BASE_URL") ??
    Deno.env.get("NEXT_PUBLIC_APP_URL");
  const normalized = explicit?.trim();
  return normalized ? normalized.replace(/\/$/, "") : null;
};

const resolvePath = (): string => {
  const raw = Deno.env.get("LOCAL_TTS_PATH") ?? "/api/tts-local";
  return raw.startsWith("/") ? raw : `/${raw}`;
};

const resolveBaseUrlCandidates = (): string[] => {
  const configured = resolveConfiguredBaseUrl();
  const candidates = [
    configured,
    "http://127.0.0.1:3000",
    "http://host.docker.internal:3000"
  ].filter((value): value is string => Boolean(value));

  return Array.from(new Set(candidates));
};

const resolveErrorMessage = (status: number, payload: LocalTtsResponse): string => {
  if (payload.error) {
    return payload.error;
  }
  return `local_tts_http_${status}`;
};

export const synthesizeLocalAudio = async (
  input: SynthesizeLocalAudioInput
): Promise<{ audioUrl: string; durationSec: number }> => {
  const script = input.text.trim();
  if (!script) {
    throw new Error("episode script is empty");
  }

  const routePath = resolvePath();
  const localTtsApiKey = Deno.env.get("LOCAL_TTS_API_KEY");
  let lastError: Error | null = null;

  for (const baseUrl of resolveBaseUrlCandidates()) {
    try {
      const response = await fetch(`${baseUrl}${routePath}`, {
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

      const payload = (await response.json().catch(() => ({}))) as LocalTtsResponse;
      if (!response.ok || payload.ok !== true || typeof payload.audioUrl !== "string") {
        throw new Error(resolveErrorMessage(response.status, payload));
      }

      return {
        audioUrl: payload.audioUrl,
        durationSec: typeof payload.durationSec === "number" ? payload.durationSec : 120
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }

  throw lastError ?? new Error("local_tts_request_failed");
};
