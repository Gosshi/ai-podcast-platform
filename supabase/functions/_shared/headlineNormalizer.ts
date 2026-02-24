import { sanitizeScriptText } from "./scriptSanitizer.ts";

export type ConcreteSignals = {
  numbers: string[];
  dates: string[];
  actors: string[];
};

const CATEGORY_SUBJECT_FALLBACK: Record<string, string> = {
  tech: "テック業界",
  ai: "生成AI業界",
  game: "ゲーム業界",
  gaming: "ゲーム業界",
  business: "企業動向",
  economy: "経済動向",
  science: "研究開発",
  health: "ヘルスケア",
  entertainment: "エンタメ業界",
  sports: "スポーツ界"
};

const SUBJECT_RULES: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\b(playstation|ps5|ps4)\b/i, label: "PS5" },
  { pattern: /\b(nintendo|switch)\b/i, label: "任天堂" },
  { pattern: /\b(xbox)\b/i, label: "Xbox" },
  { pattern: /\b(openai|chatgpt|gpt-?4|gpt-?5)\b/i, label: "生成AI" },
  { pattern: /\b(apple|iphone|ipad|mac)\b/i, label: "Apple" },
  { pattern: /\b(google|android|pixel)\b/i, label: "Google" },
  { pattern: /\b(microsoft|windows|copilot)\b/i, label: "Microsoft" },
  { pattern: /\b(meta|instagram|facebook|whatsapp)\b/i, label: "Meta" },
  { pattern: /\b(amazon|aws|prime)\b/i, label: "Amazon" },
  { pattern: /\b(tesla|ev|electric vehicle)\b/i, label: "EV市場" },
  { pattern: /\b(nvidia)\b/i, label: "NVIDIA" }
];

const EVENT_RULES: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\b(sale|discount|deal|off)\b/i, label: "大型セール開始" },
  { pattern: /\b(release|launch|debut|unveil|announce)\b/i, label: "新発表" },
  { pattern: /\b(update|patch|upgrade)\b/i, label: "大型更新" },
  { pattern: /\b(price hike|price rise|increase|price cut|cut price)\b/i, label: "価格改定" },
  { pattern: /\b(earnings|revenue|profit|quarter results)\b/i, label: "決算発表" },
  { pattern: /\b(acquire|acquisition|merge|merger)\b/i, label: "買収関連が進展" },
  { pattern: /\b(lawsuit|antitrust|probe|investigation)\b/i, label: "規制論点が浮上" },
  { pattern: /\b(hack|breach|leak|data leak)\b/i, label: "情報流出懸念" },
  { pattern: /\b(raise|funding|investment round)\b/i, label: "資金調達が進展" },
  { pattern: /\b(partner|partnership|collaboration)\b/i, label: "提携発表" },
  { pattern: /\b(layoff|job cut|shutdown|close)\b/i, label: "構造見直しへ" }
];

const ENGLISH_STOP_WORDS = new Set([
  "the",
  "this",
  "that",
  "these",
  "those",
  "today",
  "tomorrow",
  "yesterday",
  "breaking",
  "update",
  "news",
  "report",
  "new"
]);

const sanitizePlainText = (value: string): string => {
  return sanitizeScriptText(value)
    .replace(/[“”"']/g, "")
    .replace(/\s+/g, " ")
    .trim();
};

const dedupeList = (values: string[], limit: number): string[] => {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const normalized = value.trim();
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(normalized);
    if (result.length >= limit) break;
  }

  return result;
};

const hasJapanese = (value: string): boolean => /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u.test(value);
const isMostlyLatin = (value: string): boolean => {
  const latin = (value.match(/[A-Za-z]/g) ?? []).length;
  if (latin === 0) return false;
  const japanese = (value.match(/[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/gu) ?? []).length;
  return latin > japanese * 2;
};

const truncateHeadline = (value: string, maxChars = 22): string => {
  if (value.length <= maxChars) return value;
  return `${value.slice(0, maxChars).trimEnd()}…`;
};

const resolveCategorySubject = (category: string): string => {
  const key = sanitizePlainText(category).toLowerCase();
  return CATEGORY_SUBJECT_FALLBACK[key] ?? "注目トピック";
};

const findSubject = (title: string, category: string): string => {
  for (const rule of SUBJECT_RULES) {
    if (rule.pattern.test(title)) {
      return rule.label;
    }
  }

  const acronym = title.match(/\b[A-Z]{2,6}\d{0,2}\b/);
  if (acronym) {
    return acronym[0];
  }

  return resolveCategorySubject(category);
};

const findEvent = (title: string, numbers: string[]): string => {
  for (const rule of EVENT_RULES) {
    if (rule.pattern.test(title)) {
      return rule.label;
    }
  }

  if (numbers.length > 0) {
    return `${numbers[0]}に注目`;
  }

  return "最新動向";
};

export const normalizeHeadline = (title: string, category = "general", contextText = ""): string => {
  const cleanedTitle = sanitizePlainText(title);
  const context = sanitizePlainText(contextText);
  const signalSource = sanitizePlainText(`${cleanedTitle} ${context}`);
  if (!cleanedTitle) {
    return truncateHeadline(`${resolveCategorySubject(category)}最新動向`);
  }
  if (hasJapanese(cleanedTitle)) {
    return truncateHeadline(cleanedTitle);
  }

  const signals = extractConcreteSignals(signalSource);
  const normalized = `${findSubject(signalSource, category)}${findEvent(signalSource, signals.numbers)}`;
  return truncateHeadline(normalized);
};

const ensureTrailingStop = (value: string): string => {
  if (!value) return "";
  return /[。.!?！？]$/.test(value) ? value : `${value}。`;
};

const clipAtBoundary = (value: string, maxChars: number): string => {
  if (value.length <= maxChars) return value;
  let clipped = value.slice(0, maxChars);
  const boundary = Math.max(
    clipped.lastIndexOf("。"),
    clipped.lastIndexOf("！"),
    clipped.lastIndexOf("？"),
    clipped.lastIndexOf(". "),
    clipped.lastIndexOf("! "),
    clipped.lastIndexOf("? ")
  );
  if (boundary > Math.floor(maxChars * 0.55)) {
    clipped = clipped.slice(0, boundary + 1);
  }
  return `${clipped.trimEnd()}…`;
};

export const compressSummary = (summary: string): string => {
  const cleaned = sanitizePlainText(summary);
  if (!cleaned) {
    return "公開情報の更新点を確認し、影響と次の注目点を整理します。";
  }

  if (isMostlyLatin(cleaned)) {
    const signals = extractConcreteSignals(cleaned);
    const actorPart = signals.actors.length > 0 ? signals.actors.slice(0, 2).join("・") : "関連主体";
    const numberPart = signals.numbers.length > 0 ? `数字は${signals.numbers.slice(0, 2).join("、")}` : "数値は公開範囲で確認";
    const datePart = signals.dates.length > 0 ? `時点は${signals.dates[0]}` : "時点は最新更新を優先";
    const converted = `${actorPart}に関する更新があり、${numberPart}、${datePart}を押さえる必要があります。` +
      "一次情報の更新順と影響範囲を分けて確認するのが実務的です。";
    return ensureTrailingStop(clipAtBoundary(converted, 280));
  }

  const sentences = cleaned
    .split(/(?<=[。.!?！？])\s+/u)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);

  const selected = dedupeList(sentences.length > 0 ? sentences : [cleaned], 2).map((sentence) => {
    const clipped = sentence.length > 170 ? `${sentence.slice(0, 170).trimEnd()}…` : sentence;
    return ensureTrailingStop(clipped);
  });

  const joined = selected.join(" ");
  const bounded = clipAtBoundary(joined, 280);
  return ensureTrailingStop(bounded);
};

export const extractConcreteSignals = (summary: string): ConcreteSignals => {
  const cleaned = sanitizePlainText(summary);
  if (!cleaned) {
    return {
      numbers: [],
      dates: [],
      actors: []
    };
  }

  const numbers = dedupeList(
    cleaned.match(/(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?(?:%|％|億|万|円|ドル|人|社|件|台|年|か月|ヶ月|日|時間|分)?/g) ?? [],
    4
  );
  const dates = dedupeList(
    cleaned.match(
      /(?:\d{4}[/-]\d{1,2}[/-]\d{1,2}|\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?|\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\.?\s+\d{1,2}(?:,\s*\d{4})?|\d{1,2}月\d{1,2}日|\d{4}年\d{1,2}月\d{1,2}日)/gi
    ) ?? [],
    3
  );

  const actorMatches = [
    ...(cleaned.match(/\b[A-Z][A-Za-z0-9&.-]{1,}(?:\s+[A-Z][A-Za-z0-9&.-]{1,}){0,2}\b/g) ?? []),
    ...(cleaned.match(/\b[A-Z]{2,6}\d{0,2}\b/g) ?? []),
    ...(cleaned.match(/[\p{Script=Han}\p{Script=Katakana}A-Za-z0-9]{2,}(?:社|省|庁|委員会|政府|銀行|大学|研究所)/gu) ?? [])
  ];
  const actors = dedupeList(
    actorMatches.filter((actor) => !ENGLISH_STOP_WORDS.has(actor.toLowerCase())),
    4
  );

  return {
    numbers,
    dates,
    actors
  };
};
