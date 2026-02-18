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
};

const EPISODE_ID_PATTERN = /^[0-9a-fA-F-]{8,64}$/;
const MAX_TEXT_LENGTH = 12000;

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

let cachedAvailableVoices: Promise<Set<string>> | null = null;

const getAvailableVoices = async (): Promise<Set<string>> => {
  if (!cachedAvailableVoices) {
    cachedAvailableVoices = runCommandWithOutput("say", ["-v", "?"])
      .then(({ stdout }) => {
        const voices = new Set<string>();
        for (const line of stdout.split(/\r?\n/)) {
          const match = line.match(/^\s*(.+?)\s+[a-z]{2}_[A-Z]{2}\s+#/);
          if (match) {
            voices.add(match[1].trim());
          }
        }
        return voices;
      })
      .catch(() => new Set<string>());
  }

  return cachedAvailableVoices;
};

const resolveEnglishVoiceCandidates = async (): Promise<string[]> => {
  const configured =
    process.env.LOCAL_TTS_EN_VOICE?.trim() || process.env.LOCAL_TTS_VOICE_EN?.trim() || null;
  if (configured) {
    return Array.from(new Set([configured, "Alex", "Samantha"]));
  }

  const availableVoices = await getAvailableVoices();
  const primary = availableVoices.has("Alex") ? "Alex" : availableVoices.has("Samantha") ? "Samantha" : "Alex";
  const fallback = primary === "Alex" ? "Samantha" : "Alex";
  return [primary, fallback];
};

const sanitizeEnglishTextForTts = (text: string): string => {
  const sanitizedLines = text
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();
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
}> => {
  const raw = (await request.json().catch(() => ({}))) as RequestBody;
  const episodeId = typeof raw.episodeId === "string" ? raw.episodeId.trim() : "";
  const lang = raw.lang === "ja" || raw.lang === "en" ? raw.lang : null;
  const text = typeof raw.text === "string" ? raw.text.trim() : "";

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

  return { episodeId, lang, text };
};

const synthesizeWav = async (
  episodeId: string,
  lang: TtsLang,
  text: string
): Promise<{ durationSec: number; voiceUsed: string | null }> => {
  const outputDir = path.join(process.cwd(), "public", "audio");
  await fs.mkdir(outputDir, { recursive: true });

  const outputFileName = `${episodeId}.${lang}.wav`;
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

  let payload: { episodeId: string; lang: TtsLang; text: string };
  try {
    payload = await parseBody(request);
  } catch (error) {
    const message = error instanceof Error ? error.message : "invalid_request";
    return jsonResponse({ ok: false, error: message }, 400);
  }

  try {
    const synthesized = await synthesizeWav(payload.episodeId, payload.lang, payload.text);
    if (payload.lang === "en") {
      console.info(
        `[tts-local] lang=en episodeId=${payload.episodeId} voice=${synthesized.voiceUsed ?? "unknown"}`
      );
    }
    return jsonResponse({
      ok: true,
      audioUrl: `/audio/${payload.episodeId}.${payload.lang}.wav`,
      durationSec: synthesized.durationSec,
      voiceUsed: synthesized.voiceUsed
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "local_tts_failed";
    return jsonResponse({ ok: false, error: message }, 500);
  }
}
