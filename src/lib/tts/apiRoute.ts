import { promises as fs } from "node:fs";
import path from "node:path";
import { createServiceRoleClient } from "@/app/lib/supabaseClients";
import {
  localTtsProvider,
  openAiTtsProvider,
  resolveConfiguredTtsProvider,
  type SynthesizeInput,
  type TtsAudioFormat,
  type TtsLang,
  type TtsProviderName
} from "./provider";
import { preTtsNormalize } from "./preTtsNormalize";

type RequestBody = {
  episodeId?: unknown;
  lang?: unknown;
  text?: unknown;
  audioVersion?: unknown;
  voice?: unknown;
  format?: unknown;
  speed?: unknown;
  instructions?: unknown;
};

type EpisodeScriptRow = {
  script: string | null;
};

const EPISODE_ID_PATTERN = /^[0-9a-fA-F-]{8,64}$/;
const AUDIO_VERSION_PATTERN = /^[a-z0-9]{3,64}$/;
const MAX_TEXT_LENGTH = 12000;

const FORMAT_TO_CONTENT_TYPE: Record<TtsAudioFormat, string> = {
  mp3: "audio/mpeg",
  opus: "audio/opus",
  aac: "audio/aac",
  flac: "audio/flac",
  wav: "audio/wav",
  pcm: "audio/L16"
};

const SUPPORTED_FORMATS = new Set<TtsAudioFormat>(["mp3", "opus", "aac", "flac", "wav", "pcm"]);
let cachedServiceRoleClient: ReturnType<typeof createServiceRoleClient> | null = null;

class TtsApiError extends Error {
  readonly status: number;
  readonly errorType: string;

  constructor(status: number, errorType: string, message: string) {
    super(message);
    this.status = status;
    this.errorType = errorType;
  }
}

const jsonResponse = (body: Record<string, unknown>, status = 200): Response => {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  });
};

const jsonErrorResponse = (errorType: string, message: string, status: number): Response => {
  return jsonResponse(
    {
      ok: false,
      errorType,
      message,
      // Backward-compat: existing callers may still inspect `error`.
      error: errorType
    },
    status
  );
};

const hasValidApiKey = (request: Request): boolean => {
  const configured = process.env.LOCAL_TTS_API_KEY?.trim();
  if (!configured) return true;
  const requestKey = request.headers.get("x-local-tts-api-key")?.trim();
  return requestKey === configured;
};

const isLocalTtsEnabled = (): boolean => {
  if (process.platform !== "darwin") return false;
  if (process.env.ENABLE_LOCAL_TTS === "true") return true;
  return process.env.NODE_ENV === "development";
};

const sanitizeFormat = (value: unknown): TtsAudioFormat | undefined => {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toLowerCase() as TtsAudioFormat;
  return SUPPORTED_FORMATS.has(normalized) ? normalized : undefined;
};

const sanitizeSpeed = (value: unknown): number | undefined => {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return Math.min(4, Math.max(0.25, value));
};

const getServiceRoleClient = (): ReturnType<typeof createServiceRoleClient> => {
  if (cachedServiceRoleClient) {
    return cachedServiceRoleClient;
  }

  try {
    cachedServiceRoleClient = createServiceRoleClient();
    return cachedServiceRoleClient;
  } catch {
    throw new TtsApiError(
      500,
      "supabase_service_role_missing",
      "SUPABASE service role is not configured"
    );
  }
};

const fetchEpisodeScript = async (episodeId: string, lang: TtsLang): Promise<string> => {
  const serviceRoleClient = getServiceRoleClient();
  const { data, error } = await serviceRoleClient
    .from("episodes")
    .select("script")
    .eq("id", episodeId)
    .eq("lang", lang)
    .maybeSingle<EpisodeScriptRow>();

  if (error) {
    throw new TtsApiError(500, "episode_lookup_failed", "Failed to load episode");
  }

  if (!data) {
    throw new TtsApiError(404, "episode_not_found", "Episode not found");
  }

  const script = typeof data.script === "string" ? data.script.trim() : "";
  if (!script) {
    throw new TtsApiError(400, "script_missing", "Episode script is empty");
  }

  return script;
};

const parseBody = async (request: Request): Promise<{
  episodeId: string;
  audioVersion: string | null;
  synthesizeInput: SynthesizeInput;
}> => {
  const raw = (await request.json().catch(() => {
    throw new TtsApiError(400, "invalid_json", "Request body must be valid JSON");
  })) as RequestBody;

  const episodeId = typeof raw.episodeId === "string" ? raw.episodeId.trim() : "";
  const lang = raw.lang === "ja" || raw.lang === "en" ? raw.lang : null;
  let text = typeof raw.text === "string" ? raw.text.trim() : "";
  const audioVersion = typeof raw.audioVersion === "string" ? raw.audioVersion.trim().toLowerCase() : null;
  const voice = typeof raw.voice === "string" && raw.voice.trim() ? raw.voice.trim() : undefined;
  const instructions =
    typeof raw.instructions === "string" && raw.instructions.trim()
      ? raw.instructions.trim()
      : undefined;
  const format = sanitizeFormat(raw.format);
  const speed = sanitizeSpeed(raw.speed);

  if (!EPISODE_ID_PATTERN.test(episodeId)) {
    throw new TtsApiError(400, "invalid_episode_id", "episodeId is invalid");
  }
  if (!lang) {
    throw new TtsApiError(400, "invalid_lang", "lang must be ja or en");
  }

  if (!text) {
    text = await fetchEpisodeScript(episodeId, lang);
  }

  text = preTtsNormalize(text, lang);

  if (text.length > MAX_TEXT_LENGTH) {
    throw new TtsApiError(400, "text_too_long", "text exceeds maximum length");
  }
  if (audioVersion && !AUDIO_VERSION_PATTERN.test(audioVersion)) {
    throw new TtsApiError(400, "invalid_audio_version", "audioVersion is invalid");
  }

  return {
    episodeId,
    audioVersion,
    synthesizeInput: {
      text,
      lang: lang as TtsLang,
      ...(voice ? { voice } : {}),
      ...(format ? { format } : {}),
      ...(typeof speed === "number" ? { speed } : {}),
      ...(instructions ? { instructions } : {})
    }
  };
};

const ensureLocalProviderAvailable = (): void => {
  if (process.platform !== "darwin") {
    throw new TtsApiError(501, "local_tts_requires_macos", "Local TTS is only available on macOS");
  }
  if (!isLocalTtsEnabled()) {
    throw new TtsApiError(501, "local_tts_disabled", "Local TTS is disabled");
  }
};

const resolveExtensionFromContentType = (contentType: string | null): TtsAudioFormat | null => {
  if (!contentType) return null;
  const normalized = contentType.toLowerCase();
  if (normalized.includes("audio/mpeg")) return "mp3";
  if (normalized.includes("audio/opus")) return "opus";
  if (normalized.includes("audio/aac")) return "aac";
  if (normalized.includes("audio/flac")) return "flac";
  if (normalized.includes("audio/wav") || normalized.includes("audio/wave")) return "wav";
  if (normalized.includes("audio/l16") || normalized.includes("audio/pcm")) return "pcm";
  return null;
};

const resolveOutputFormat = (
  preferredFormat: TtsAudioFormat | undefined,
  contentType: string
): TtsAudioFormat => {
  if (preferredFormat) {
    return preferredFormat;
  }

  return resolveExtensionFromContentType(contentType) ?? "wav";
};

const estimateDurationSec = (bytes: Uint8Array, format: TtsAudioFormat, text: string): number => {
  if (format === "wav" && bytes.length > 44) {
    const payloadBytes = Math.max(0, bytes.length - 44);
    return Math.max(1, Math.round(payloadBytes / 44100));
  }

  return Math.max(1, Math.round(text.length / 12));
};

const writeAudioFile = async (params: {
  episodeId: string;
  lang: TtsLang;
  audioVersion: string | null;
  bytes: Uint8Array;
  format: TtsAudioFormat;
}): Promise<string> => {
  const outputDir = path.join(process.cwd(), "public", "audio");
  await fs.mkdir(outputDir, { recursive: true });

  const outputFileName = params.audioVersion
    ? `${params.episodeId}.${params.lang}.${params.audioVersion}.${params.format}`
    : `${params.episodeId}.${params.lang}.${params.format}`;
  const outputPath = path.join(outputDir, outputFileName);
  await fs.writeFile(outputPath, params.bytes);
  return `/${path.posix.join("audio", outputFileName)}`;
};

const synthesizeWithProvider = async (
  provider: TtsProviderName,
  input: SynthesizeInput
): Promise<{
  bytes: Uint8Array;
  contentType: string;
  provider: TtsProviderName;
  model?: string;
  voice?: string;
  format: TtsAudioFormat;
}> => {
  if (provider === "local") {
    ensureLocalProviderAvailable();
    return localTtsProvider.synthesize(input);
  }

  return openAiTtsProvider.synthesize(input);
};

export async function handleTtsRequest(request: Request): Promise<Response> {
  if (request.method !== "POST") {
    return jsonErrorResponse("method_not_allowed", "Method not allowed", 405);
  }
  if (!hasValidApiKey(request)) {
    return jsonErrorResponse("unauthorized", "Unauthorized", 401);
  }

  let payload: { episodeId: string; audioVersion: string | null; synthesizeInput: SynthesizeInput };
  try {
    payload = await parseBody(request);
  } catch (error) {
    if (error instanceof TtsApiError) {
      return jsonErrorResponse(error.errorType, error.message, error.status);
    }

    return jsonErrorResponse("invalid_request", "Invalid request", 400);
  }

  const requestedProvider = resolveConfiguredTtsProvider();
  let fallbackReason: string | null = null;

  try {
    let result: Awaited<ReturnType<typeof synthesizeWithProvider>>;
    if (requestedProvider === "openai") {
      try {
        result = await synthesizeWithProvider("openai", payload.synthesizeInput);
      } catch (openAiError) {
        const errorMessage = openAiError instanceof Error ? openAiError.message : "openai_tts_failed";
        try {
          result = await synthesizeWithProvider("local", payload.synthesizeInput);
          fallbackReason = errorMessage;
        } catch (fallbackError) {
          const fallbackMessage =
            fallbackError instanceof Error ? fallbackError.message : "local_fallback_failed";
          throw new Error(`${errorMessage}; fallback:${fallbackMessage}`);
        }
      }
    } else {
      result = await synthesizeWithProvider("local", payload.synthesizeInput);
    }

    const outputFormat = resolveOutputFormat(result.format, result.contentType);
    const audioUrl = await writeAudioFile({
      episodeId: payload.episodeId,
      lang: payload.synthesizeInput.lang,
      audioVersion: payload.audioVersion,
      bytes: result.bytes,
      format: outputFormat
    });

    return jsonResponse({
      ok: true,
      audioUrl,
      durationSec: estimateDurationSec(result.bytes, outputFormat, payload.synthesizeInput.text),
      provider: result.provider,
      requestedProvider,
      model: result.model ?? null,
      voice: result.voice ?? null,
      format: outputFormat,
      contentType: result.contentType || FORMAT_TO_CONTENT_TYPE[outputFormat],
      fallbackReason
    });
  } catch (error) {
    if (error instanceof TtsApiError) {
      return jsonErrorResponse(error.errorType, error.message, error.status);
    }

    const message = error instanceof Error ? error.message : "tts_failed";
    if (message === "local_tts_requires_macos") {
      return jsonErrorResponse("local_tts_requires_macos", "Local TTS is only available on macOS", 501);
    }
    if (message === "local_tts_disabled") {
      return jsonErrorResponse("local_tts_disabled", "Local TTS is disabled", 501);
    }
    if (message === "openai_tts_timeout") {
      return jsonErrorResponse("openai_tts_timeout", "OpenAI TTS request timed out", 504);
    }

    return jsonErrorResponse("tts_failed", message, 500);
  }
}
