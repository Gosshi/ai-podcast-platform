import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

export const runtime = "nodejs";

type TtsLang = "ja" | "en";

type RequestBody = {
  episodeId?: unknown;
  lang?: unknown;
  text?: unknown;
  audioVersion?: unknown;
};

const EPISODE_ID_PATTERN = /^[0-9a-fA-F-]{8,64}$/;
const AUDIO_VERSION_PATTERN = /^[a-z0-9]{3,64}$/;
const MAX_TEXT_LENGTH = 12000;
const JAPANESE_CHAR_PATTERN = /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u;

const jsonResponse = (body: Record<string, unknown>, status = 200): Response => {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  });
};

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

const resolveVoice = (lang: TtsLang): string | null => {
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

  const preferredBaseNames = [
    configured,
    "Samantha",
    "Alex",
    "Eddy",
    "Flo"
  ].filter((voice): voice is string => Boolean(voice));

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

  const primary = "Samantha";
  const fallback = primary === "Samantha" ? "Alex" : "Samantha";
  return [primary, fallback];
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

const isEnabled = (): boolean => {
  if (process.env.ENABLE_LOCAL_TTS === "true") return true;
  return process.env.NODE_ENV === "development";
};

const hasValidApiKey = (request: Request): boolean => {
  const configured = process.env.LOCAL_TTS_API_KEY?.trim();
  if (!configured) return true;
  const requestKey = request.headers.get("x-local-tts-api-key")?.trim();
  return requestKey === configured;
};

const parseBody = async (request: Request): Promise<{
  episodeId: string;
  lang: TtsLang;
  text: string;
  audioVersion: string | null;
}> => {
  const raw = (await request.json().catch(() => ({}))) as RequestBody;
  const episodeId = typeof raw.episodeId === "string" ? raw.episodeId.trim() : "";
  const lang = raw.lang === "ja" || raw.lang === "en" ? raw.lang : null;
  const text = typeof raw.text === "string" ? raw.text.trim() : "";
  const audioVersion = typeof raw.audioVersion === "string" ? raw.audioVersion.trim().toLowerCase() : null;

  if (!EPISODE_ID_PATTERN.test(episodeId)) {
    throw new Error("invalid_episode_id");
  }
  if (!lang) {
    throw new Error("invalid_lang");
  }
  if (!text) {
    throw new Error("text_required");
  }
  if (text.length > MAX_TEXT_LENGTH) {
    throw new Error("text_too_long");
  }
  if (audioVersion && !AUDIO_VERSION_PATTERN.test(audioVersion)) {
    throw new Error("invalid_audio_version");
  }

  return { episodeId, lang, text, audioVersion };
};

const synthesizeWav = async (
  episodeId: string,
  lang: TtsLang,
  text: string,
  audioVersion: string | null
): Promise<{ durationSec: number; voiceUsed: string | null }> => {
  const outputDir = path.join(process.cwd(), "public", "audio");
  await fs.mkdir(outputDir, { recursive: true });

  const outputFileName = audioVersion
    ? `${episodeId}.${lang}.${audioVersion}.wav`
    : `${episodeId}.${lang}.wav`;
  const outputPath = path.join(outputDir, outputFileName);

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "local-tts-"));
  const textPath = path.join(tempDir, `${episodeId}.${lang}.txt`);
  const aiffPath = path.join(tempDir, `${episodeId}.${lang}.aiff`);
  let voiceUsed: string | null = null;

  try {
    const scriptForTts = lang === "en" ? sanitizeEnglishTextForTts(text) : text;
    await fs.writeFile(textPath, scriptForTts, "utf8");
    const baseSayArgs = ["-f", textPath, "-o", aiffPath];

    if (lang === "en") {
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
      const voice = resolveVoice(lang);
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

    await runCommand("afconvert", ["-f", "WAVE", "-d", "LEI16", aiffPath, outputPath]);

    const stat = await fs.stat(outputPath);
    const payloadBytes = Math.max(0, stat.size - 44);
    return {
      durationSec: Math.max(1, Math.round(payloadBytes / 44100)),
      voiceUsed
    };
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
};

export async function POST(request: Request) {
  if (!isEnabled()) {
    return jsonResponse({ ok: false, error: "local_tts_disabled" }, 403);
  }
  if (!hasValidApiKey(request)) {
    return jsonResponse({ ok: false, error: "unauthorized" }, 401);
  }
  if (process.platform !== "darwin") {
    return jsonResponse({ ok: false, error: "local_tts_requires_macos" }, 501);
  }

  let payload: { episodeId: string; lang: TtsLang; text: string; audioVersion: string | null };
  try {
    payload = await parseBody(request);
  } catch (error) {
    const message = error instanceof Error ? error.message : "invalid_request";
    return jsonResponse({ ok: false, error: message }, 400);
  }

  try {
    const synthesized = await synthesizeWav(
      payload.episodeId,
      payload.lang,
      payload.text,
      payload.audioVersion
    );
    if (payload.lang === "en") {
      console.info(
        `[tts-local] lang=en episodeId=${payload.episodeId} voice=${synthesized.voiceUsed ?? "unknown"}`
      );
    }
    const audioPath = payload.audioVersion
      ? `/audio/${payload.episodeId}.${payload.lang}.${payload.audioVersion}.wav`
      : `/audio/${payload.episodeId}.${payload.lang}.wav`;
    return jsonResponse({
      ok: true,
      audioUrl: audioPath,
      durationSec: synthesized.durationSec,
      voiceUsed: synthesized.voiceUsed
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "local_tts_failed";
    return jsonResponse({ ok: false, error: message }, 500);
  }
}
