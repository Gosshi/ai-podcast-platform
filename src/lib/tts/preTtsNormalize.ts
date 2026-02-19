import type { TtsLang } from "./provider";
import { readFileSync } from "node:fs";
import path from "node:path";

type TtsDictionary = {
  ja: Record<string, string>;
};

const loadDictionary = (): TtsDictionary => {
  const dictionaryPath = path.join(process.cwd(), "src", "lib", "tts", "dictionary.json");
  const raw = readFileSync(dictionaryPath, "utf8");
  return JSON.parse(raw) as TtsDictionary;
};

const dictionary = loadDictionary();

const JA_MAX_SENTENCE_CHARS = 90;

const normalizeWhitespace = (value: string): string => {
  return value
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
};

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const isAsciiWord = (value: string): boolean => /^[\x00-\x7F]+$/.test(value);

const applyJaDictionary = (value: string): string => {
  const entries = Object.entries(dictionary.ja).sort((left, right) => right[0].length - left[0].length);
  let output = value;

  for (const [term, reading] of entries) {
    if (!term || !reading) continue;
    if (isAsciiWord(term)) {
      output = output.replace(new RegExp(escapeRegExp(term), "gi"), reading);
      continue;
    }
    output = output.replaceAll(term, reading);
  }

  return output;
};

const splitLongJaSentence = (sentence: string): string[] => {
  const trimmed = sentence.trim();
  if (!trimmed) return [];
  if (trimmed.length <= JA_MAX_SENTENCE_CHARS) return [trimmed];

  const chunks: string[] = [];
  let buffer = "";
  const parts = trimmed.split(/(?<=[、,，])/u);

  for (const part of parts) {
    if (!part) continue;
    if (!buffer) {
      buffer = part;
      continue;
    }

    if ((buffer + part).length <= JA_MAX_SENTENCE_CHARS) {
      buffer += part;
    } else {
      chunks.push(buffer.trim());
      buffer = part;
    }
  }

  if (buffer.trim()) {
    chunks.push(buffer.trim());
  }

  if (chunks.length === 1 && chunks[0].length > JA_MAX_SENTENCE_CHARS) {
    return chunks[0].match(new RegExp(`.{1,${JA_MAX_SENTENCE_CHARS}}`, "gu")) ?? [chunks[0]];
  }

  return chunks;
};

const splitJaBySentence = (value: string): string => {
  const lines = value.split(/\n+/).map((line) => line.trim()).filter((line) => line.length > 0);
  const sentences: string[] = [];

  for (const line of lines) {
    const parts = line.match(/[^。！？!?]+[。！？!?]?/gu) ?? [line];
    for (const part of parts) {
      const normalized = part.trim();
      if (!normalized) continue;
      sentences.push(...splitLongJaSentence(normalized));
    }
  }

  return sentences.join("\n");
};

export const preTtsNormalize = (text: string, lang: TtsLang): string => {
  const normalized = normalizeWhitespace(text);
  if (!normalized) return normalized;
  if (lang !== "ja") return normalized;

  const dictionaryApplied = applyJaDictionary(normalized);
  return splitJaBySentence(dictionaryApplied);
};
