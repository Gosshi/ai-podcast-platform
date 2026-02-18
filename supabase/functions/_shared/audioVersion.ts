const encoder = new TextEncoder();
const OPENAI_TTS_FORMATS = new Set(["mp3", "opus", "aac", "flac", "wav", "pcm"]);

type TtsLang = "ja" | "en";

export type TtsSignatureConfig = {
  provider: "openai" | "local";
  model: string;
  voice: string;
  format: string;
  speed: number | null;
  instructions: string | null;
};

const toHex = (bytes: Uint8Array): string => {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

const normalizeScript = (value: string): string => {
  return value.replace(/\r\n/g, "\n").trim();
};

const normalizeProvider = (value: string | null | undefined): "openai" | "local" => {
  return value?.trim().toLowerCase() === "openai" ? "openai" : "local";
};

const resolveOpenAiModel = (): string => {
  const value = Deno.env.get("OPENAI_TTS_MODEL")?.trim();
  return value || "tts-1";
};

const resolveOpenAiVoice = (lang: TtsLang): string => {
  const value =
    lang === "ja" ? Deno.env.get("OPENAI_TTS_VOICE_JA")?.trim() : Deno.env.get("OPENAI_TTS_VOICE_EN")?.trim();
  return value || "alloy";
};

const resolveOpenAiFormat = (): string => {
  const value = Deno.env.get("OPENAI_TTS_FORMAT")?.trim().toLowerCase();
  if (value && OPENAI_TTS_FORMATS.has(value)) {
    return value;
  }

  return "wav";
};

const resolveOpenAiSpeed = (): number | null => {
  const value = Deno.env.get("OPENAI_TTS_SPEED")?.trim();
  if (!value) {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return Math.min(4, Math.max(0.25, parsed));
};

const resolveOpenAiInstructions = (lang: TtsLang): string | null => {
  const value =
    lang === "ja"
      ? Deno.env.get("OPENAI_TTS_INSTRUCTIONS_JA")?.trim()
      : Deno.env.get("OPENAI_TTS_INSTRUCTIONS_EN")?.trim();
  return value || null;
};

const serializeTtsSignature = (config: TtsSignatureConfig): string => {
  return [
    config.provider,
    config.model,
    config.voice,
    config.format,
    config.speed === null ? "" : String(config.speed),
    config.instructions ?? ""
  ].join("|");
};

export const resolveConfiguredTtsProvider = (): "openai" | "local" => {
  return normalizeProvider(Deno.env.get("TTS_PROVIDER"));
};

export const resolveTtsSignatureConfig = (lang: TtsLang): TtsSignatureConfig => {
  return {
    provider: resolveConfiguredTtsProvider(),
    model: resolveOpenAiModel(),
    voice: resolveOpenAiVoice(lang),
    format: resolveOpenAiFormat(),
    speed: resolveOpenAiSpeed(),
    instructions: resolveOpenAiInstructions(lang)
  };
};

export const buildAudioVersion = async (script: string, ttsConfig?: TtsSignatureConfig): Promise<string> => {
  const normalized = normalizeScript(script);
  if (!normalized && !ttsConfig) {
    return "empty";
  }

  const signatureInput = ttsConfig
    ? `${normalized}|${serializeTtsSignature(ttsConfig)}`
    : normalized;
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(signatureInput));
  return toHex(new Uint8Array(digest)).slice(0, 16);
};

export const buildLocalAudioUrl = (params: {
  episodeId: string;
  lang: "ja" | "en";
  audioVersion: string;
}): string => {
  return `/audio/${params.episodeId}.${params.lang}.${params.audioVersion}.wav`;
};

export const hasVersionedAudioUrl = (params: {
  episodeId: string;
  lang: "ja" | "en";
  audioVersion: string;
  audioUrl: string | null;
}): boolean => {
  const value = params.audioUrl?.trim().toLowerCase();
  if (!value) {
    return false;
  }

  const prefix = `/audio/${params.episodeId.toLowerCase()}.${params.lang}.${params.audioVersion.toLowerCase()}.`;
  return value.startsWith(prefix);
};
