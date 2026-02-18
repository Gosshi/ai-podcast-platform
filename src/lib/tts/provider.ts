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
  return raw || "tts-1";
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
    const body: Record<string, unknown> = {
      model,
      voice,
      input: input.text,
      response_format: format
    };

    if (speed !== undefined) {
      body.speed = speed;
    }

    if (model === "gpt-4o-mini-tts") {
      const instructions = resolveOpenAiInstructions(input.lang, input.instructions);
      if (instructions) {
        body.instructions = instructions;
      }
    }

    const response = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      throw new Error(
        `openai_tts_http_${response.status}:${errorBody.slice(0, 200) || "request_failed"}`
      );
    }

    const bytes = new Uint8Array(await response.arrayBuffer());
    return {
      bytes,
      contentType: response.headers.get("content-type") ?? "application/octet-stream",
      provider: "openai" as const,
      model,
      voice,
      format
    };
  }
};

export const resolveConfiguredTtsProvider = (): TtsProviderName => {
  return process.env.TTS_PROVIDER?.trim().toLowerCase() === "openai" ? "openai" : "local";
};
