export type SpeechLang = "ja" | "en";

const URL_PATTERN = /https?:\/\/\S+/gi;
const HTTP_WORD_PATTERN = /\bhttps?\b/gi;
const PERCENT_PATTERN = /(\d+(?:\.\d+)?)\s*%/g;
const AI_PATTERN = /\bAI\b/gi;
const MATH_EXPRESSION_PATTERN =
  /\b[\w().]+(?:\s*(?:\+|-|×|x|\*|\/|=)\s*[\w().]+){1,}\b/g;

const normalizeCommon = (value: string): string => {
  return value
    .replace(/\r\n/g, "\n")
    .replace(URL_PATTERN, " SOURCE_LINK ")
    .replace(HTTP_WORD_PATTERN, " HTTP_WORD ")
    .replace(PERCENT_PATTERN, (_, numberText: string) => ` ${numberText} PERCENT_TOKEN `)
    .replace(AI_PATTERN, " AI_TOKEN ")
    .replace(MATH_EXPRESSION_PATTERN, " MATH_TOKEN ")
    .replace(/\s+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
};

const normalizeJapanese = (value: string): string => {
  return value
    .replace(/SOURCE_LINK/g, "参照リンク")
    .replace(/HTTP_WORD/g, "エイチティーティーピー")
    .replace(/PERCENT_TOKEN/g, "パーセント")
    .replace(/AI_TOKEN/g, "エーアイ")
    .replace(/MATH_TOKEN/g, "数式")
    .replace(/&/g, "アンド")
    .replace(/@/g, "アットマーク")
    .replace(/\$/g, "ドル")
    .replace(/\s+([、。,.!?！？])/g, "$1")
    .trim();
};

const normalizeEnglish = (value: string): string => {
  return value
    .replace(/SOURCE_LINK/g, "source link")
    .replace(/HTTP_WORD/g, "H T T P")
    .replace(/PERCENT_TOKEN/g, "percent")
    .replace(/AI_TOKEN/g, "A I")
    .replace(/MATH_TOKEN/g, "equation")
    .replace(/&/g, " and ")
    .replace(/@/g, " at ")
    .replace(/\$/g, " dollars ")
    .replace(/\s+([,.!?])/g, "$1")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
};

export const normalizeForSpeech = (value: string, lang: SpeechLang): string => {
  const common = normalizeCommon(value);
  return lang === "ja" ? normalizeJapanese(common) : normalizeEnglish(common);
};
