export type TtsLang = "ja" | "en";

export type TtsPreprocessMetrics = {
  urlReplacedCount: number;
  bracketRemovedCount: number;
  mappedWordCount: number;
  pauseInsertedCount: number;
};

export type TtsPreprocessResult = {
  text: string;
  changed: boolean;
  metrics: TtsPreprocessMetrics;
};

const URL_PATTERN = /https?:\/\/[^\s)\]}>]+/gi;
const WWW_URL_PATTERN = /\bwww\.[^\s)\]}>]+/gi;
const BRACKET_PATTERN = /[\[\]{}()<>【】「」『』]/g;

const JA_URL_REPLACEMENT = "概要欄をご覧ください";
const EN_URL_REPLACEMENT = "please see the show notes";

const JA_WORD_MAP: Array<[RegExp, string]> = [
  [/\bOpenAI\b/gi, "オープンエーアイ"],
  [/\bAI\b/g, "エーアイ"],
  [/\bAPI\b/g, "エーピーアイ"],
  [/\bGPU\b/g, "ジーピーユー"],
  [/\bCPU\b/g, "シーピーユー"],
  [/\bYouTube\b/gi, "ユーチューブ"],
  [/\bTikTok\b/gi, "ティックトック"],
  [/\bX\b/g, "エックス"]
];

const normalizeWhitespace = (value: string): string => {
  return value
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
};

const replaceUrls = (value: string, replacement: string): { text: string; count: number } => {
  const urlCount = (value.match(URL_PATTERN)?.length ?? 0) + (value.match(WWW_URL_PATTERN)?.length ?? 0);
  const replaced = value.replace(URL_PATTERN, replacement).replace(WWW_URL_PATTERN, replacement);
  return { text: replaced, count: urlCount };
};

const removeBrackets = (value: string): { text: string; count: number } => {
  const count = value.match(BRACKET_PATTERN)?.length ?? 0;
  return {
    text: value.replace(BRACKET_PATTERN, ""),
    count
  };
};

const mapJapaneseWords = (value: string): { text: string; count: number } => {
  let output = value;
  let count = 0;

  for (const [pattern, replacement] of JA_WORD_MAP) {
    const matches = output.match(pattern)?.length ?? 0;
    if (matches === 0) continue;
    count += matches;
    output = output.replace(pattern, replacement);
  }

  return { text: output, count };
};

const optimizePunctuation = (value: string, lang: TtsLang): string => {
  if (lang === "ja") {
    return value
      .replace(/[!！]{2,}/g, "！")
      .replace(/[?？]{2,}/g, "？")
      .replace(/\.{3,}/g, "。")
      .replace(/;+/g, "、")
      .replace(/:+/g, "、")
      .replace(/\s+([、。！？])/g, "$1")
      .replace(/[、]{2,}/g, "、")
      .replace(/[。]{2,}/g, "。");
  }

  return value
    .replace(/[!]{2,}/g, "!")
    .replace(/[?]{2,}/g, "?")
    .replace(/\.{3,}/g, ".")
    .replace(/;+/g, ",")
    .replace(/:+/g, ",")
    .replace(/\s+([,.!?])/g, "$1");
};

const insertPauseMarkers = (value: string, lang: TtsLang): { text: string; count: number } => {
  const sentences = value
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  let count = 0;
  const output = sentences.map((line) => {
    if (lang === "ja") {
      const parts = line
        .split(/(?<=[、。！？])/u)
        .map((part) => part.trim())
        .filter((part) => part.length > 0);

      if (parts.length > 1) {
        count += 1;
      }

      return parts.join("\n");
    }

    const parts = line
      .split(/(?<=[,.!?])/)
      .map((part) => part.trim())
      .filter((part) => part.length > 0);

    if (parts.length > 1) {
      count += 1;
    }

    return parts.join("\n");
  });

  return {
    text: output.join("\n").replace(/\n{3,}/g, "\n\n").trim(),
    count
  };
};

export const preprocessForTTS = (text: string, lang: TtsLang): TtsPreprocessResult => {
  const initial = normalizeWhitespace(text);
  if (!initial) {
    return {
      text: "",
      changed: false,
      metrics: {
        urlReplacedCount: 0,
        bracketRemovedCount: 0,
        mappedWordCount: 0,
        pauseInsertedCount: 0
      }
    };
  }

  const urlReplacement = lang === "ja" ? JA_URL_REPLACEMENT : EN_URL_REPLACEMENT;
  const urls = replaceUrls(initial, urlReplacement);
  const bracket = removeBrackets(urls.text);
  const mapped = lang === "ja" ? mapJapaneseWords(bracket.text) : { text: bracket.text, count: 0 };
  const punctuated = optimizePunctuation(mapped.text, lang);
  const paused = insertPauseMarkers(punctuated, lang);
  const normalized = normalizeWhitespace(paused.text);

  return {
    text: normalized,
    changed: normalized !== initial,
    metrics: {
      urlReplacedCount: urls.count,
      bracketRemovedCount: bracket.count,
      mappedWordCount: mapped.count,
      pauseInsertedCount: paused.count
    }
  };
};

export const isTtsPreprocessEnabled = (): boolean => {
  const raw = (Deno.env.get("ENABLE_TTS_PREPROCESS") ?? "").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes";
};
