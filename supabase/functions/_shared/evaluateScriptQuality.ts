import { hasOpenAiApiKey, summarizeError, type PolishLang } from "./scriptPolish.ts";

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

type ScriptQualityScores = {
  depth: number;
  clarity: number;
  repetition: number;
  concreteness: number;
  broadcast_readiness: number;
};

type ScriptQualityResponse = ScriptQualityScores & {
  rationale: string;
};

export type ScriptQualityDetail = ScriptQualityScores & {
  score: number;
  warning: boolean;
  rationale: string;
  attempts_used: number;
  model: string;
  timeout_ms: number;
};

export type ScriptQualityEvaluationResult =
  | {
      ok: true;
      detail: ScriptQualityDetail;
    }
  | {
      ok: false;
      skipped_reason?: string;
      error_summary?: string;
      attempts_used: number;
      model: string;
      timeout_ms: number;
    };

const OPENAI_CHAT_API_URL = "https://api.openai.com/v1/chat/completions";
const DEFAULT_SCORE_MODEL = "gpt-4.1-mini";
const DEFAULT_SCORE_TIMEOUT_MS = 60_000;
const DEFAULT_SCORE_MAX_ATTEMPTS = 2;
const MAX_COMPLETION_TOKENS = 1_000;

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

const clampScore = (value: unknown): number | null => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  return Math.min(10, Math.max(0, Number(value.toFixed(2))));
};

const resolveScore = (raw: unknown): ScriptQualityResponse | null => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }

  const record = raw as Record<string, unknown>;
  const depth = clampScore(record.depth);
  const clarity = clampScore(record.clarity);
  const repetition = clampScore(record.repetition);
  const concreteness = clampScore(record.concreteness);
  const broadcastReadiness = clampScore(record.broadcast_readiness);
  const rationale = typeof record.rationale === "string" ? record.rationale.trim() : "";

  if (
    depth === null ||
    clarity === null ||
    repetition === null ||
    concreteness === null ||
    broadcastReadiness === null ||
    !rationale
  ) {
    return null;
  }

  return {
    depth,
    clarity,
    repetition,
    concreteness,
    broadcast_readiness: broadcastReadiness,
    rationale
  };
};

const parseEvaluationJson = (content: string): ScriptQualityResponse | null => {
  try {
    const parsed = JSON.parse(extractJsonText(content)) as unknown;
    return resolveScore(parsed);
  } catch {
    return null;
  }
};

export const resolveScriptQualityModel = (): string => {
  const model =
    Deno.env.get("OPENAI_SCRIPT_SCORE_MODEL")?.trim() ||
    Deno.env.get("SCRIPT_SCORE_MODEL")?.trim() ||
    Deno.env.get("OPENAI_SCRIPT_MODEL")?.trim();
  return model && model.length > 0 ? model : DEFAULT_SCORE_MODEL;
};

export const resolveScriptQualityTimeoutMs = (): number => {
  const raw = Number.parseInt(Deno.env.get("SCRIPT_SCORE_TIMEOUT_MS") ?? "", 10);
  if (!Number.isFinite(raw)) {
    return DEFAULT_SCORE_TIMEOUT_MS;
  }
  return Math.min(120_000, Math.max(5_000, raw));
};

export const resolveScriptQualityMaxAttempts = (): number => {
  const raw = Number.parseInt(Deno.env.get("SCRIPT_SCORE_MAX_ATTEMPTS") ?? "", 10);
  if (!Number.isFinite(raw)) {
    return DEFAULT_SCORE_MAX_ATTEMPTS;
  }
  return Math.min(2, Math.max(1, raw));
};

const SCORE_SYSTEM_PROMPT = [
  "You are a senior radio producer evaluating a podcast script.",
  "Score each metric from 0 to 10 using only the provided script.",
  "Higher repetition score means less repetition and better variety.",
  "Do not invent external facts.",
  "Return valid JSON only."
].join(" ");

const toScoreUserPrompt = (params: { script: string; lang: PolishLang }): string => {
  const localeNote =
    params.lang === "ja"
      ? "The script is in Japanese. Judge spoken naturalness and pacing for Japanese broadcast."
      : "The script is in English. Judge spoken naturalness and pacing for English broadcast.";

  return [
    "Evaluate this script for broadcast quality.",
    localeNote,
    "Metrics (0-10): depth, clarity, repetition, concreteness, broadcast_readiness.",
    "Definition:",
    "- depth: contextual richness and analytical depth",
    "- clarity: easy-to-follow structure and sentence clarity",
    "- repetition: variety of expression (10 means minimal repetition)",
    "- concreteness: concrete details, numbers, named references, examples",
    "- broadcast_readiness: can be read on-air without major edits",
    "Return JSON only with keys: depth, clarity, repetition, concreteness, broadcast_readiness, rationale.",
    "",
    "SCRIPT:",
    params.script
  ].join("\n");
};

const requestScoreJson = async (params: {
  model: string;
  timeoutMs: number;
  script: string;
  lang: PolishLang;
}): Promise<string> => {
  const apiKey = Deno.env.get("OPENAI_API_KEY")?.trim();
  if (!apiKey) {
    throw new Error("openai_api_key_missing");
  }

  const response = await fetch(OPENAI_CHAT_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: params.model,
      temperature: 0,
      max_completion_tokens: MAX_COMPLETION_TOKENS,
      messages: [
        {
          role: "system",
          content: SCORE_SYSTEM_PROMPT
        },
        {
          role: "user",
          content: toScoreUserPrompt({
            script: params.script,
            lang: params.lang
          })
        }
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "script_quality_score",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            required: ["depth", "clarity", "repetition", "concreteness", "broadcast_readiness", "rationale"],
            properties: {
              depth: { type: "number", minimum: 0, maximum: 10 },
              clarity: { type: "number", minimum: 0, maximum: 10 },
              repetition: { type: "number", minimum: 0, maximum: 10 },
              concreteness: { type: "number", minimum: 0, maximum: 10 },
              broadcast_readiness: { type: "number", minimum: 0, maximum: 10 },
              rationale: { type: "string", minLength: 10, maxLength: 400 }
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

export const evaluateScriptQuality = async (params: {
  script: string;
  lang: PolishLang;
  model?: string;
  timeoutMs?: number;
  maxAttempts?: number;
}): Promise<ScriptQualityEvaluationResult> => {
  const script = params.script.trim();
  const model = params.model?.trim() || resolveScriptQualityModel();
  const timeoutMs = params.timeoutMs ?? resolveScriptQualityTimeoutMs();
  const maxAttempts = params.maxAttempts ?? resolveScriptQualityMaxAttempts();

  if (!script) {
    return {
      ok: false,
      skipped_reason: "empty_script",
      attempts_used: 0,
      model,
      timeout_ms: timeoutMs
    };
  }

  if (!hasOpenAiApiKey()) {
    return {
      ok: false,
      skipped_reason: "openai_api_key_missing",
      attempts_used: 0,
      model,
      timeout_ms: timeoutMs
    };
  }

  let attemptsUsed = 0;
  let latestError = "";
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    attemptsUsed = attempt;
    try {
      const raw = await requestScoreJson({
        model,
        timeoutMs,
        script,
        lang: params.lang
      });
      const parsed = parseEvaluationJson(raw);
      if (!parsed) {
        latestError = "quality_json_parse_failed";
        continue;
      }

      const score = Number(
        (
          (parsed.depth +
            parsed.clarity +
            parsed.repetition +
            parsed.concreteness +
            parsed.broadcast_readiness) /
          5
        ).toFixed(2)
      );
      return {
        ok: true,
        detail: {
          ...parsed,
          score,
          warning: score < 8,
          attempts_used: attemptsUsed,
          model,
          timeout_ms: timeoutMs
        }
      };
    } catch (error) {
      latestError = summarizeError(error);
    }
  }

  return {
    ok: false,
    error_summary: latestError || "quality_score_failed",
    attempts_used: attemptsUsed,
    model,
    timeout_ms: timeoutMs
  };
};
