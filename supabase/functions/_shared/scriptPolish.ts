import { normalizeScriptText, dedupeSimilarLines } from "./scriptNormalize.ts";
import { decodeEntities } from "./scriptSanitizer.ts";
import { parseScriptSections, renderScriptSections } from "./scriptSections.ts";

export type PolishLang = "ja" | "en";

export type PolishedScriptJson = {
  title: string;
  sections: {
    op: string;
    headline: string;
    deepdive: [string, string, string];
    quicknews: [string, string, string, string, string, string];
    letters: string;
    outro: string;
  };
  preview: string;
};

type OpenAiChatResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  error?: {
    message?: string;
  };
};

const OPENAI_CHAT_API_URL = "https://api.openai.com/v1/chat/completions";
const DEFAULT_SCRIPT_MODEL = "gpt-4.1-mini";
const DEFAULT_SCRIPT_POLISH_TIMEOUT_MS = 120_000;
const DEFAULT_SCRIPT_POLISH_TEMPERATURE = 0.2;
const DEFAULT_SCRIPT_POLISH_MAX_ATTEMPTS = 2;
const DEFAULT_SCRIPT_POLISH_TARGET = "15-20min";
const TRUE_ENV_VALUES = new Set(["1", "true", "yes", "on"]);
const FALSE_ENV_VALUES = new Set(["0", "false", "no", "off"]);

const URL_PATTERN = /https?:\/\/[^\s)\]}>]+/gi;
const WWW_URL_PATTERN = /\bwww\.[^\s)\]}>]+/gi;
const SOURCES_SECTION_PATTERN = /^SOURCES(?:_FOR_UI)?$/i;
const JA_NUMERIC_REFERENCE_PATTERN =
  /\b\d[\d,./-]*(?:%|％|倍|人|円|ドル|万|億|兆|年|月|日|時間|分|秒|件|社|台|GB|MB|万人|万件|万台)?\b/g;
const JA_ORG_REFERENCE_PATTERN = /[一-龯々]{2,}(?:省|庁|大学|研究所|機構|銀行|政府|委員会|協会|企業|社|市|県|都|府)/g;
const JA_QUOTED_REFERENCE_PATTERN = /「[^」]{2,40}」/g;
const EN_NUMERIC_REFERENCE_PATTERN =
  /\b\d[\d,./-]*(?:%|percent|million|billion|trillion|k|m|bn|year|years|month|months|day|days|hour|hours)?\b/gi;
const EN_PROPER_NOUN_PATTERN = /\b[A-Z][A-Za-z0-9&.+-]{2,}(?:\s+[A-Z][A-Za-z0-9&.+-]{2,}){0,3}\b/g;
const EN_ABBREVIATION_PATTERN = /\b[A-Z]{2,6}\b/g;
const ROMAN_REFERENCE_PATTERN = /\b[A-Z][A-Za-z0-9&.+-]{1,}(?:\s+[A-Z][A-Za-z0-9&.+-]{1,}){0,3}\b/g;
const EN_PROPER_NOUN_STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "as",
  "at",
  "but",
  "for",
  "from",
  "if",
  "in",
  "into",
  "it",
  "of",
  "on",
  "or",
  "so",
  "than",
  "that",
  "the",
  "this",
  "to",
  "we",
  "with"
]);

const toStringValue = (value: unknown): string => {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
};

const toStringTuple = <TLen extends number>(
  value: unknown,
  expectedLength: TLen
): string[] | null => {
  if (!Array.isArray(value) || value.length !== expectedLength) {
    return null;
  }

  const normalized = value.map((item) => toStringValue(item));
  if (normalized.some((item) => item.length === 0)) {
    return null;
  }

  return normalized;
};

const collapseWhitespace = (value: string): string => {
  return value
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
};

export const normalizeScriptForPolishInput = (script: string): string => {
  const decoded = decodeEntities(script);

  return collapseWhitespace(
    decoded
      .replace(URL_PATTERN, "[URL]")
      .replace(WWW_URL_PATTERN, "[URL]")
      .replace(/アンド#8217;?/gi, "and")
      .replace(/#8217;?/gi, "'")
      .replace(/数式/g, "計算式")
  );
};

const stripCodeFence = (value: string): string => {
  const trimmed = value.trim();
  const fenced = trimmed.match(/^```[a-zA-Z0-9_-]*\n([\s\S]*?)\n```$/);
  return fenced ? fenced[1].trim() : trimmed;
};

const extractJsonText = (value: string): string => {
  const stripped = stripCodeFence(value);
  const firstBrace = stripped.indexOf("{");
  const lastBrace = stripped.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    return stripped;
  }
  return stripped.slice(firstBrace, lastBrace + 1);
};

export const resolveScriptPolishModel = (fallbackModel = DEFAULT_SCRIPT_MODEL): string => {
  const model = Deno.env.get("OPENAI_SCRIPT_MODEL")?.trim() || Deno.env.get("SCRIPT_POLISH_MODEL")?.trim();
  return model && model.length > 0 ? model : fallbackModel;
};

export const resolveScriptPolishTemperature = (): number => {
  const raw = Number.parseFloat(Deno.env.get("OPENAI_SCRIPT_POLISH_TEMPERATURE") ?? "");
  if (!Number.isFinite(raw)) {
    return DEFAULT_SCRIPT_POLISH_TEMPERATURE;
  }

  return Math.min(1, Math.max(0, raw));
};

export const resolveScriptPolishTimeoutMs = (): number => {
  const raw = Number.parseInt(
    Deno.env.get("SCRIPT_POLISH_TIMEOUT_MS") ?? Deno.env.get("OPENAI_SCRIPT_POLISH_TIMEOUT_MS") ?? "",
    10
  );
  if (!Number.isFinite(raw)) {
    return DEFAULT_SCRIPT_POLISH_TIMEOUT_MS;
  }

  return Math.min(120_000, Math.max(5_000, raw));
};

export const resolveScriptPolishEnabled = (): boolean => {
  const raw = Deno.env.get("SCRIPT_POLISH_ENABLED");
  if (raw === undefined) {
    return true;
  }
  const normalized = raw.trim().toLowerCase();
  if (!normalized) {
    return true;
  }
  if (TRUE_ENV_VALUES.has(normalized)) {
    return true;
  }
  if (FALSE_ENV_VALUES.has(normalized)) {
    return false;
  }
  return true;
};

export const resolveScriptPolishMaxAttempts = (): number => {
  const raw = Number.parseInt(Deno.env.get("SCRIPT_POLISH_MAX_ATTEMPTS") ?? "", 10);
  if (!Number.isFinite(raw)) {
    return DEFAULT_SCRIPT_POLISH_MAX_ATTEMPTS;
  }
  return Math.min(2, Math.max(1, raw));
};

export const resolveScriptPolishTarget = (): string => {
  const target = Deno.env.get("SCRIPT_POLISH_TARGET")?.trim();
  return target && target.length > 0 ? target : DEFAULT_SCRIPT_POLISH_TARGET;
};

export const hasOpenAiApiKey = (): boolean => {
  return Boolean(Deno.env.get("OPENAI_API_KEY")?.trim());
};

export const countWords = (value: string): number => {
  const normalized = value.replace(/\r\n/g, " ").trim();
  if (!normalized) {
    return 0;
  }
  return normalized
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => /[A-Za-z0-9]/.test(token)).length;
};

const countUniqueMatches = (
  value: string,
  pattern: RegExp,
  normalize?: (token: string) => string
): number => {
  const unique = new Set<string>();

  for (const matched of value.matchAll(pattern)) {
    const token = matched[0]?.trim();
    if (!token) {
      continue;
    }
    const normalized = normalize ? normalize(token) : token.toLowerCase();
    if (!normalized) {
      continue;
    }
    unique.add(normalized);
  }

  return unique.size;
};

const countJaConcreteReferences = (value: string): number => {
  return (
    countUniqueMatches(value, JA_NUMERIC_REFERENCE_PATTERN) +
    countUniqueMatches(value, JA_ORG_REFERENCE_PATTERN) +
    countUniqueMatches(value, JA_QUOTED_REFERENCE_PATTERN) +
    countUniqueMatches(value, ROMAN_REFERENCE_PATTERN)
  );
};

const countEnConcreteReferences = (value: string): number => {
  const properNounCount = countUniqueMatches(value, EN_PROPER_NOUN_PATTERN, (token) => {
    const normalized = token.trim().toLowerCase();
    return EN_PROPER_NOUN_STOPWORDS.has(normalized) ? "" : normalized;
  });

  return (
    countUniqueMatches(value, EN_NUMERIC_REFERENCE_PATTERN) +
    properNounCount +
    countUniqueMatches(value, EN_ABBREVIATION_PATTERN)
  );
};

export type DeepDiveConcreteCheck = {
  ok: boolean;
  minRequired: number;
  counts: [number, number, number];
  failingIndices: number[];
};

export const checkDeepDiveConcreteReferences = (
  lang: PolishLang,
  deepDive: [string, string, string]
): DeepDiveConcreteCheck => {
  const minRequired = 2;
  const counts = deepDive.map((section) => {
    const normalized = collapseWhitespace(section);
    return lang === "ja" ? countJaConcreteReferences(normalized) : countEnConcreteReferences(normalized);
  }) as [number, number, number];

  const failingIndices = counts
    .map((count, index) => (count < minRequired ? index : -1))
    .filter((index) => index >= 0);

  return {
    ok: failingIndices.length === 0,
    minRequired,
    counts,
    failingIndices
  };
};

export const requestPolishJsonFromOpenAi = async (params: {
  model: string;
  temperature: number;
  timeoutMs: number;
  systemPrompt: string;
  userPrompt: string;
  schemaName: string;
  maxCompletionTokens?: number;
  minLengths?: {
    title?: number;
    preview?: number;
    op?: number;
    headline?: number;
    deepdiveItem?: number;
    quicknewsItem?: number;
    letters?: number;
    outro?: number;
  };
}): Promise<string> => {
  const apiKey = Deno.env.get("OPENAI_API_KEY")?.trim();
  if (!apiKey) {
    throw new Error("openai_api_key_missing");
  }

  const minTitleLength = Math.max(1, Math.floor(params.minLengths?.title ?? 1));
  const minPreviewLength = Math.max(1, Math.floor(params.minLengths?.preview ?? 1));
  const minOpLength = Math.max(1, Math.floor(params.minLengths?.op ?? 1));
  const minHeadlineLength = Math.max(1, Math.floor(params.minLengths?.headline ?? 1));
  const minDeepdiveItemLength = Math.max(1, Math.floor(params.minLengths?.deepdiveItem ?? 1));
  const minQuicknewsItemLength = Math.max(1, Math.floor(params.minLengths?.quicknewsItem ?? 1));
  const minLettersLength = Math.max(1, Math.floor(params.minLengths?.letters ?? 1));
  const minOutroLength = Math.max(1, Math.floor(params.minLengths?.outro ?? 1));

  const response = await fetch(OPENAI_CHAT_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: params.model,
      temperature: params.temperature,
      max_completion_tokens: params.maxCompletionTokens && params.maxCompletionTokens > 0
        ? params.maxCompletionTokens
        : 8_192,
      messages: [
        {
          role: "system",
          content: params.systemPrompt
        },
        {
          role: "user",
          content: params.userPrompt
        }
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: params.schemaName,
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            required: ["title", "sections", "preview"],
            properties: {
              title: { type: "string", minLength: minTitleLength },
              sections: {
                type: "object",
                additionalProperties: false,
                required: ["op", "headline", "deepdive", "quicknews", "letters", "outro"],
                properties: {
                  op: { type: "string", minLength: minOpLength },
                  headline: { type: "string", minLength: minHeadlineLength },
                  deepdive: {
                    type: "array",
                    minItems: 3,
                    maxItems: 3,
                    items: { type: "string", minLength: minDeepdiveItemLength }
                  },
                  quicknews: {
                    type: "array",
                    minItems: 6,
                    maxItems: 6,
                    items: { type: "string", minLength: minQuicknewsItemLength }
                  },
                  letters: { type: "string", minLength: minLettersLength },
                  outro: { type: "string", minLength: minOutroLength }
                }
              },
              preview: { type: "string", minLength: minPreviewLength }
            }
          }
        }
      }
    }),
    signal: AbortSignal.timeout(params.timeoutMs)
  });

  const payload = (await response.json().catch(() => ({}))) as OpenAiChatResponse;
  if (!response.ok) {
    throw new Error(payload.error?.message?.trim() || `openai_http_${response.status}`);
  }

  const content = payload.choices?.[0]?.message?.content;
  if (typeof content !== "string" || content.trim().length === 0) {
    throw new Error("openai_empty_response");
  }

  return content.trim();
};

export const parsePolishedScriptJson = (
  value: string
):
  | {
      ok: true;
      data: PolishedScriptJson;
    }
  | {
      ok: false;
      error: string;
    } => {
  try {
    const parsed = JSON.parse(extractJsonText(value)) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { ok: false, error: "json_not_object" };
    }

    const root = parsed as Record<string, unknown>;
    const title = toStringValue(root.title);
    const preview = toStringValue(root.preview);

    const sectionsRaw = root.sections;
    if (!sectionsRaw || typeof sectionsRaw !== "object" || Array.isArray(sectionsRaw)) {
      return { ok: false, error: "sections_invalid" };
    }

    const sections = sectionsRaw as Record<string, unknown>;
    const op = toStringValue(sections.op);
    const headline = toStringValue(sections.headline);
    const deepdive = toStringTuple(sections.deepdive, 3);
    const quicknews = toStringTuple(sections.quicknews, 6);
    const letters = toStringValue(sections.letters);
    const outro = toStringValue(sections.outro);

    if (!title || !preview || !op || !headline || !deepdive || !quicknews || !letters || !outro) {
      return { ok: false, error: "json_schema_mismatch" };
    }

    return {
      ok: true,
      data: {
        title,
        preview,
        sections: {
          op,
          headline,
          deepdive: [deepdive[0], deepdive[1], deepdive[2]],
          quicknews: [quicknews[0], quicknews[1], quicknews[2], quicknews[3], quicknews[4], quicknews[5]],
          letters,
          outro
        }
      }
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
};

export const dedupeConsecutiveLines = (value: string): { text: string; removedCount: number } => {
  const lines = value.replace(/\r\n/g, "\n").split("\n");
  const deduped: string[] = [];
  let removedCount = 0;

  const normalize = (line: string): string => line.trim().replace(/[ \t]+/g, " ").toLowerCase();

  for (const line of lines) {
    const last = deduped[deduped.length - 1] ?? "";
    const currentKey = normalize(line);
    const lastKey = normalize(last);

    if (currentKey && currentKey === lastKey) {
      removedCount += 1;
      continue;
    }

    deduped.push(line);
  }

  return {
    text: collapseWhitespace(deduped.join("\n")),
    removedCount
  };
};

const renderQuickNewsLines = (lang: PolishLang, lines: [string, string, string, string, string, string]): string => {
  if (lang === "ja") {
    return lines.map((line, index) => `クイックニュース${index + 1}: ${line}`).join("\n");
  }

  return lines.map((line, index) => `Quick update ${index + 1}: ${line}`).join("\n");
};

const extractSourceSections = (script: string): { heading: string; body: string }[] => {
  return parseScriptSections(script)
    .filter((section) => SOURCES_SECTION_PATTERN.test(section.heading))
    .map((section) => ({
      heading: section.heading,
      body: section.body
    }));
};

export const renderPolishedScriptText = (params: {
  lang: PolishLang;
  polished: PolishedScriptJson;
  originalScript: string;
}): string => {
  const sources = extractSourceSections(params.originalScript);

  if (params.lang === "ja") {
    const scriptSections = [
      { heading: "OP", body: params.polished.sections.op },
      { heading: "HEADLINE", body: params.polished.sections.headline },
      { heading: "DEEPDIVE 1", body: params.polished.sections.deepdive[0] },
      { heading: "DEEPDIVE 2", body: params.polished.sections.deepdive[1] },
      { heading: "DEEPDIVE 3", body: params.polished.sections.deepdive[2] },
      { heading: "QUICK NEWS", body: renderQuickNewsLines("ja", params.polished.sections.quicknews) },
      { heading: "LETTERS", body: params.polished.sections.letters },
      { heading: "OUTRO", body: params.polished.sections.outro },
      ...sources
    ];

    return collapseWhitespace(`TITLE: ${params.polished.title}\n\n${renderScriptSections(scriptSections)}`);
  }

  const scriptSections = [
    { heading: "OPENING", body: params.polished.sections.op },
    { heading: "HEADLINE", body: params.polished.sections.headline },
    { heading: "MAIN TOPIC 1", body: params.polished.sections.deepdive[0] },
    { heading: "MAIN TOPIC 2", body: params.polished.sections.deepdive[1] },
    { heading: "MAIN TOPIC 3", body: params.polished.sections.deepdive[2] },
    { heading: "QUICK NEWS", body: renderQuickNewsLines("en", params.polished.sections.quicknews) },
    { heading: "LETTERS CORNER", body: params.polished.sections.letters },
    { heading: "CLOSING", body: params.polished.sections.outro },
    ...sources
  ];

  return collapseWhitespace(`TITLE: ${params.polished.title}\n\n${renderScriptSections(scriptSections)}`);
};

export const finalizePolishedScriptText = (value: string): { text: string; dedupedLinesCount: number } => {
  const normalized = normalizeScriptText(value, { preserveSourceUrls: true });
  const dedupedConsecutive = dedupeConsecutiveLines(normalized.text);
  const dedupedSimilar = dedupeSimilarLines(dedupedConsecutive.text, {
    minComparableLength: 8,
    lookBackLines: 120
  });

  return {
    text: dedupedSimilar.text,
    dedupedLinesCount: normalized.metrics.dedupedLinesCount + dedupedConsecutive.removedCount + dedupedSimilar.dedupedLinesCount
  };
};

export const buildPolishPreview = (value: string): string => {
  const normalized = collapseWhitespace(value);
  if (!normalized) {
    return "";
  }

  return normalized.length <= 280 ? normalized : `${normalized.slice(0, 280).trimEnd()}...`;
};

export const summarizeError = (value: unknown): string => {
  const raw = value instanceof Error ? value.message : String(value ?? "unknown_error");
  const normalized = collapseWhitespace(raw);
  return normalized.slice(0, 500);
};
