import type { TtsAudioFormat, TtsLang } from "./tts/provider";

export const DEFAULT_AUDIO_STORAGE_BUCKET = "audio";

export const resolveAudioStorageBucket = (): string => {
  const configured = process.env.AUDIO_STORAGE_BUCKET?.trim();
  return configured || DEFAULT_AUDIO_STORAGE_BUCKET;
};

export const buildAudioStorageObjectPath = (params: {
  episodeId: string;
  lang: TtsLang;
  audioVersion: string | null;
  format: TtsAudioFormat;
}): string => {
  const suffix = params.audioVersion ? `${params.audioVersion}.${params.format}` : `latest.${params.format}`;
  return `episodes/${params.episodeId}/${params.lang}/${suffix}`;
};

export const canUseSupabaseAudioStorage = (): boolean => {
  return Boolean(
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() &&
      (process.env.SUPABASE_URL?.trim() || process.env.NEXT_PUBLIC_SUPABASE_URL?.trim())
  );
};
