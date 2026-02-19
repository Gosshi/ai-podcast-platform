import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

export type TtsLang = "ja" | "en";
export type TtsProviderName = "openai" | "local";
export type TtsAudioFormat = "mp3" | "opus" | "aac" | "flac" | "wav" | "pcm";

export type SynthesizeInput = {
  text: string;
  lang: TtsLang;
  voice?: string;
  format?: TtsAudioFormat;
  speed?: number;
  instructions?: string;
};

export type SynthesizeOutput = {
  bytes: Uint8Array;
  contentType: string;
  provider: TtsProviderName;
  model?: string;
  voice?: string;
  format: TtsAudioFormat;
};

export interface TtsProvider {
  synthesize(input: SynthesizeInput): Promise<SynthesizeOutput>;
}

const JAPANESE_CHAR_PATTERN = /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u;
const OPENAI_TTS_FORMATS = new Set<TtsAudioFormat>(["mp3", "opus", "aac", "flac", "wav", "pcm"]);
const resolveOpenAiTimeoutMs = (): number => {
  const raw = Number.parseInt(process.env.OPENAI_TTS_TIMEOUT_MS ?? "120000", 10);
  if (!Number.isFinite(raw)) return 120_000;
  return Math.max(30_000, Math.min(raw, 300_000));
};
const OPENAI_TTS_TIMEOUT_MS = resolveOpenAiTimeoutMs();
const resolveOpenAiMaxInputChars = (): number => {
  const raw = Number.parseInt(process.env.OPENAI_TTS_MAX_INPUT_CHARS ?? "1500", 10);
  if (!Number.isFinite(raw)) return 1500;
  return Math.max(200, Math.min(raw, 4000));
};
const OPENAI_TTS_MAX_INPUT_CHARS = resolveOpenAiMaxInputChars();

const runCommand = async (command: string, args: string[]): Promise<void> => {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args);
    let stderr = "";

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} exited with code ${code}: ${stderr.trim()}`));
    });
  });
};

const runCommandWithOutput = async (
  command: string,
  args: string[]
): Promise<{ stdout: string; stderr: string }> => {
  return await new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(command, args);
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }
      reject(new Error(`${command} exited with code ${code}: ${stderr.trim()}`));
    });
  });
};

const resolveLocalVoice = (lang: TtsLang): string | null => {
  const value = lang === "ja" ? process.env.LOCAL_TTS_VOICE_JA : process.env.LOCAL_TTS_EN_VOICE;
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

type VoiceCatalogItem = {
  name: string;
  locale: string;
};

let cachedAvailableVoices: Promise<VoiceCatalogItem[]> | null = null;

const getAvailableVoices = async (): Promise<VoiceCatalogItem[]> => {
  if (!cachedAvailableVoices) {
    cachedAvailableVoices = runCommandWithOutput("say", ["-v", "?"])
      .then(({ stdout }) => {
        const voices: VoiceCatalogItem[] = [];
        for (const line of stdout.split(/\r?\n/)) {
          const match = line.match(/^\s*(.+?)\s+([a-z]{2}_[A-Z]{2})\s+#/);
          if (match) {
            voices.push({
              name: match[1].trim(),
              locale: match[2].trim()
            });
          }
        }
        return voices;
      })
      .catch(() => []);
  }

  return cachedAvailableVoices;
};

const resolveEnglishVoiceCandidates = async (): Promise<string[]> => {
  const availableVoices = await getAvailableVoices();
  const findInstalledVoice = (baseName: string): string | null => {
    const normalized = baseName.trim();
    if (!normalized) {
      return null;
    }

    const exact = availableVoices.find((voice) => voice.name === normalized);
    if (exact) {
      return exact.name;
    }

    const variant = availableVoices.find((voice) => voice.name.startsWith(`${normalized} (`));
    return variant?.name ?? null;
  };

  const configured =
    process.env.LOCAL_TTS_EN_VOICE?.trim() || process.env.LOCAL_TTS_VOICE_EN?.trim() || null;

  const preferredBaseNames = [configured, "Samantha", "Alex", "Eddy", "Flo"].filter(
    (voice): voice is string => Boolean(voice)
  );

  const installedPreferred = preferredBaseNames
    .map((voice) => findInstalledVoice(voice))
    .filter((voice): voice is string => Boolean(voice));
  if (installedPreferred.length > 0) {
    return Array.from(new Set(installedPreferred));
  }

  const anyEnglish = availableVoices
    .filter((voice) => voice.locale.startsWith("en_"))
    .map((voice) => voice.name);
  if (anyEnglish.length > 0) {
    return Array.from(new Set(anyEnglish));
  }

  if (configured) {
    return [configured];
  }

  return ["Samantha", "Alex"];
};

const hasJapaneseText = (value: string): boolean => JAPANESE_CHAR_PATTERN.test(value);

const sanitizeEnglishLineForTts = (line: string): string => {
  const trimmed = line.trim();
  if (!trimmed || !hasJapaneseText(trimmed)) {
    return trimmed;
  }

  if (/^topic:/i.test(trimmed)) {
    return "Topic: key story from Japanese-language media.";
  }
  if (/^- what happened:/i.test(trimmed)) {
    return "- What happened: A notable update was reported in Japanese-language coverage.";
  }
  if (/^- why it is trending:/i.test(trimmed)) {
    return "- Why it is trending: The topic drew broad attention in Japan.";
  }
  if (/^- quick take:/i.test(trimmed)) {
    return "- Quick take: We avoid overconfident claims and follow verified updates.";
  }
  if (/^- source context:/i.test(trimmed)) {
    return "- Source context: Japanese-language media.";
  }

  return "Details from Japanese-language sources are summarized in this segment.";
};

const sanitizeEnglishTextForTts = (text: string): string => {
  const sanitizedLines = text
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => {
      const trimmed = sanitizeEnglishLineForTts(line);
      if (!trimmed) {
        return "";
      }
      if (/^https?:\/\/\S+$/i.test(trimmed)) {
        return "source link";
      }

      return line
        .replace(/https?:\/\/\S+/gi, "source link")
        .replace(/\p{Extended_Pictographic}+/gu, "")
        .replace(/([!?.,;:])\1+/g, "$1")
        .replace(/[-_=~*]{2,}/g, " ")
        .replace(/\s{2,}/g, " ")
        .trim();
    })
    .filter((line, index, lines) => line.length > 0 || (index > 0 && lines[index - 1] !== ""));

  const normalized = sanitizedLines.join("\n").trim();
  return normalized || "source link";
};

const resolveOpenAiModel = (): string => {
  const raw = process.env.OPENAI_TTS_MODEL?.trim();
  return raw || "gpt-4o-mini-tts";
};

const resolveOpenAiFormat = (format?: TtsAudioFormat): TtsAudioFormat => {
  const configured = format ?? (process.env.OPENAI_TTS_FORMAT?.trim().toLowerCase() as TtsAudioFormat);
  if (configured && OPENAI_TTS_FORMATS.has(configured)) {
    return configured;
  }
  return "wav";
};

const resolveOpenAiSpeed = (speed?: number): number | undefined => {
  if (typeof speed === "number" && Number.isFinite(speed)) {
    return Math.min(4, Math.max(0.25, speed));
  }

  const configured = process.env.OPENAI_TTS_SPEED?.trim();
  if (!configured) {
    return undefined;
  }

  const parsed = Number(configured);
  if (!Number.isFinite(parsed)) {
    return undefined;
  }

  return Math.min(4, Math.max(0.25, parsed));
};

const resolveOpenAiVoice = (lang: TtsLang, voice?: string): string => {
  const explicit = voice?.trim();
  if (explicit) {
    return explicit;
  }
  const configured =
    lang === "ja" ? process.env.OPENAI_TTS_VOICE_JA?.trim() : process.env.OPENAI_TTS_VOICE_EN?.trim();
  if (configured) {
    return configured;
  }
  return "alloy";
};

const resolveOpenAiInstructions = (lang: TtsLang, instructions?: string): string | undefined => {
  const explicit = instructions?.trim();
  if (explicit) {
    return explicit;
  }
  const configured =
    lang === "ja"
      ? process.env.OPENAI_TTS_INSTRUCTIONS_JA?.trim()
      : process.env.OPENAI_TTS_INSTRUCTIONS_EN?.trim();
  return configured || undefined;
};

const splitTextForOpenAiTts = (text: string, maxChars: number): string[] => {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];
  if (normalized.length <= maxChars) return [normalized];

  const sentenceLikeUnits = normalized
    .split(/(?<=[。！？!?])\s+|\n+/u)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  const chunks: string[] = [];
  let current = "";
  for (const unit of sentenceLikeUnits) {
    if (unit.length > maxChars) {
      if (current) {
        chunks.push(current);
        current = "";
      }
      for (let cursor = 0; cursor < unit.length; cursor += maxChars) {
        chunks.push(unit.slice(cursor, cursor + maxChars));
      }
      continue;
    }

    if (!current) {
      current = unit;
      continue;
    }

    const next = `${current}\n${unit}`;
    if (next.length <= maxChars) {
      current = next;
    } else {
      chunks.push(current);
      current = unit;
    }
  }

  if (current) {
    chunks.push(current);
  }

  return chunks.length > 0 ? chunks : [normalized];
};

const findWavChunk = (
  bytes: Uint8Array,
  chunkName: string
): { dataOffset: number; dataSize: number } | null => {
  if (bytes.length < 44) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let cursor = 12;
  while (cursor + 8 <= bytes.length) {
    const id = String.fromCharCode(
      view.getUint8(cursor),
      view.getUint8(cursor + 1),
      view.getUint8(cursor + 2),
      view.getUint8(cursor + 3)
    );
    const chunkSize = view.getUint32(cursor + 4, true);
    const dataOffset = cursor + 8;
    if (id === chunkName) {
      if (dataOffset + chunkSize > bytes.length) return null;
      return { dataOffset, dataSize: chunkSize };
    }
    cursor = dataOffset + chunkSize + (chunkSize % 2);
  }
  return null;
};

const concatWavPcm = (chunks: Uint8Array[]): Uint8Array => {
  if (chunks.length === 0) {
    return new Uint8Array();
  }
  if (chunks.length === 1) {
    return chunks[0];
  }

  const first = chunks[0];
  const firstData = findWavChunk(first, "data");
  if (!firstData) {
    throw new Error("openai_tts_invalid_wav_header");
  }

  const head = first.slice(0, firstData.dataOffset);
  const pcmDataParts: Uint8Array[] = [];
  let totalPcmBytes = 0;
  for (const chunk of chunks) {
    const data = findWavChunk(chunk, "data");
    if (!data) {
      throw new Error("openai_tts_invalid_wav_header");
    }
    const pcm = chunk.slice(data.dataOffset, data.dataOffset + data.dataSize);
    pcmDataParts.push(pcm);
    totalPcmBytes += pcm.length;
  }

  const out = new Uint8Array(head.length + totalPcmBytes);
  out.set(head, 0);

  let cursor = head.length;
  for (const pcm of pcmDataParts) {
    out.set(pcm, cursor);
    cursor += pcm.length;
  }

  const outView = new DataView(out.buffer, out.byteOffset, out.byteLength);
  outView.setUint32(4, out.length - 8, true);
  outView.setUint32(firstData.dataOffset - 4, totalPcmBytes, true);
  return out;
};

const concatBytes = (chunks: Uint8Array[]): Uint8Array => {
  if (chunks.length === 0) return new Uint8Array();
  if (chunks.length === 1) return chunks[0];

  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const out = new Uint8Array(total);
  let cursor = 0;
  for (const chunk of chunks) {
    out.set(chunk, cursor);
    cursor += chunk.length;
  }
  return out;
};

export const localTtsProvider: TtsProvider = {
  async synthesize(input) {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "local-tts-"));
    const textPath = path.join(tempDir, `script.${input.lang}.txt`);
    const aiffPath = path.join(tempDir, `audio.${input.lang}.aiff`);
    const wavPath = path.join(tempDir, `audio.${input.lang}.wav`);
    let voiceUsed: string | undefined;

    try {
      const scriptForTts = input.lang === "en" ? sanitizeEnglishTextForTts(input.text) : input.text;
      await fs.writeFile(textPath, scriptForTts, "utf8");
      const baseSayArgs = ["-f", textPath, "-o", aiffPath];

      if (input.lang === "en") {
        let lastError: Error | null = null;
        for (const voice of await resolveEnglishVoiceCandidates()) {
          try {
            await runCommand("say", ["-v", voice, ...baseSayArgs]);
            voiceUsed = voice;
            lastError = null;
            break;
          } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
          }
        }

        if (lastError) {
          throw lastError;
        }
      } else {
        const voice = resolveLocalVoice(input.lang);
        if (voice) {
          try {
            await runCommand("say", ["-v", voice, ...baseSayArgs]);
            voiceUsed = voice;
          } catch {
            await runCommand("say", baseSayArgs);
            voiceUsed = "default";
          }
        } else {
          await runCommand("say", baseSayArgs);
          voiceUsed = "default";
        }
      }

      await runCommand("afconvert", ["-f", "WAVE", "-d", "LEI16", aiffPath, wavPath]);
      const buffer = await fs.readFile(wavPath);
      return {
        bytes: new Uint8Array(buffer),
        contentType: "audio/wav",
        provider: "local" as const,
        voice: voiceUsed,
        format: "wav" as const
      };
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  }
};

export const openAiTtsProvider: TtsProvider = {
  async synthesize(input) {
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      throw new Error("openai_api_key_missing");
    }

    const model = resolveOpenAiModel();
    const voice = resolveOpenAiVoice(input.lang, input.voice);
    const format = resolveOpenAiFormat(input.format);
    const speed = resolveOpenAiSpeed(input.speed);
    const instructions = resolveOpenAiInstructions(input.lang, input.instructions);
    const textChunks = splitTextForOpenAiTts(input.text, OPENAI_TTS_MAX_INPUT_CHARS);
    if (textChunks.length === 0) {
      throw new Error("openai_tts_empty_input");
    }
    const requestFormat: TtsAudioFormat =
      format === "wav" && textChunks.length > 1 ? "mp3" : format;

    const synthesizeChunk = async (textChunk: string): Promise<Uint8Array> => {
      const body: Record<string, unknown> = {
        model,
        voice,
        input: textChunk,
        response_format: requestFormat
      };

      if (speed !== undefined) {
        body.speed = speed;
      }
      if (model === "gpt-4o-mini-tts" && instructions) {
        body.instructions = instructions;
      }

      let response: Response;
      try {
        response = await fetch("https://api.openai.com/v1/audio/speech", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(OPENAI_TTS_TIMEOUT_MS)
        });
      } catch (error) {
        if (
          (error instanceof DOMException && (error.name === "AbortError" || error.name === "TimeoutError")) ||
          (error instanceof Error &&
            (error.name === "AbortError" ||
              error.name === "TimeoutError" ||
              error.message.includes("aborted due to timeout")))
        ) {
          throw new Error("openai_tts_timeout");
        }
        throw error;
      }

      if (!response.ok) {
        const errorBody = await response.text().catch(() => "");
        throw new Error(
          `openai_tts_http_${response.status}:${errorBody.slice(0, 200) || "request_failed"}`
        );
      }
      return new Uint8Array(await response.arrayBuffer());
    };

    const chunkBytes: Uint8Array[] = [];
    for (const textChunk of textChunks) {
      chunkBytes.push(await synthesizeChunk(textChunk));
    }
    const bytes =
      requestFormat === "wav"
        ? concatWavPcm(chunkBytes)
        : concatBytes(chunkBytes);

    return {
      bytes,
      contentType: requestFormat === "wav" ? "audio/wav" : "audio/mpeg",
      provider: "openai" as const,
      model,
      voice,
      format: requestFormat
    };
  }
};

export const resolveConfiguredTtsProvider = (): TtsProviderName => {
  return process.env.TTS_PROVIDER?.trim().toLowerCase() === "openai" ? "openai" : "local";
};
