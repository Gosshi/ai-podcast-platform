const encoder = new TextEncoder();

const toHex = (bytes: Uint8Array): string => {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

const normalizeScript = (value: string): string => {
  return value.replace(/\r\n/g, "\n").trim();
};

export const buildAudioVersion = async (script: string): Promise<string> => {
  const normalized = normalizeScript(script);
  if (!normalized) {
    return "empty";
  }

  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(normalized));
  return toHex(new Uint8Array(digest)).slice(0, 16);
};

export const buildLocalAudioUrl = (params: {
  episodeId: string;
  lang: "ja" | "en";
  audioVersion: string;
}): string => {
  return `/audio/${params.episodeId}.${params.lang}.${params.audioVersion}.wav`;
};
