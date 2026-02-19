import { normalizeScriptText, type ScriptNormalizationMetrics } from "./scriptNormalize.ts";

type ChatMessage = {
  role: "system" | "user";
  content: string;
};

type OpenAiChatResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

export type ScriptEditorResult = {
  script: string;
  edited: boolean;
  enabled: boolean;
  model: string | null;
  error: string | null;
  normalizationMetrics: ScriptNormalizationMetrics;
};

const DEFAULT_MODEL = "gpt-4o-mini";
const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const MIN_EDITED_CHARS = 2000;

const SYSTEM_PROMPT =
  "あなたはプロの日本語放送作家です。自然で聞き取りやすいラジオ原稿へ整えてください。" +
  "同じ内容の繰り返しを避け、URL/プレースホルダー/HTML断片を含めず、断定を避けつつ明瞭な語り口にしてください。" +
  "元原稿に [OP] のようなセクション見出しがある場合は、それらを維持してください。" +
  "目安は2500〜3200文字ですが、意味が欠落する場合は自然さを優先してください。";

const hasSectionMarkers = (value: string): boolean => {
  return /^\[[^\]]+\]\s*$/m.test(value);
};

const countSectionMarkers = (value: string): number => {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^\[[^\]]+\]$/.test(line)).length;
};

const isEnabled = (): boolean => {
  const raw = (Deno.env.get("ENABLE_SCRIPT_EDITOR") ?? "").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes";
};

const resolveModel = (): string => {
  const model = Deno.env.get("SCRIPT_EDITOR_MODEL")?.trim();
  return model && model.length > 0 ? model : DEFAULT_MODEL;
};

const stripCodeFence = (value: string): string => {
  const trimmed = value.trim();
  const fenced = trimmed.match(/^```[a-zA-Z0-9_-]*\n([\s\S]*?)\n```$/);
  return fenced ? fenced[1].trim() : trimmed;
};

const toUserPrompt = (script: string): string => {
  return [
    "次の日本語ポッドキャスト原稿を放送品質に編集してください。",
    "制約:",
    "- URL/HTML/プレースホルダーを含めない",
    "- 同一趣旨の重複表現を削減",
    "- 日本語として自然な語順・語彙にする",
    "- セクション見出し（角括弧行）は維持",
    "",
    "原稿:",
    script
  ].join("\n");
};

const parseChatContent = (payload: OpenAiChatResponse): string => {
  const content = payload.choices?.[0]?.message?.content;
  return typeof content === "string" ? content.trim() : "";
};

const requestOpenAiEdit = async (params: {
  script: string;
  model: string;
}): Promise<string> => {
  const apiKey = Deno.env.get("OPENAI_API_KEY")?.trim();
  if (!apiKey) {
    throw new Error("openai_api_key_missing");
  }

  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: toUserPrompt(params.script) }
  ];

  const response = await fetch(OPENAI_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: params.model,
      temperature: 0.3,
      messages
    }),
    signal: AbortSignal.timeout(30_000)
  });

  const payload = (await response.json().catch(() => ({}))) as OpenAiChatResponse & {
    error?: { message?: string };
  };

  if (!response.ok) {
    const message = payload.error?.message?.trim() || `openai_http_${response.status}`;
    throw new Error(message);
  }

  const content = parseChatContent(payload);
  if (!content) {
    throw new Error("openai_empty_response");
  }

  return stripCodeFence(content);
};

export const postEditJapaneseScript = async (script: string): Promise<ScriptEditorResult> => {
  const initialNormalized = normalizeScriptText(script);

  if (!isEnabled()) {
    return {
      script: initialNormalized.text,
      edited: false,
      enabled: false,
      model: null,
      error: null,
      normalizationMetrics: initialNormalized.metrics
    };
  }

  const model = resolveModel();

  try {
    const editedRaw = await requestOpenAiEdit({
      script: initialNormalized.text,
      model
    });
    const editedNormalized = normalizeScriptText(editedRaw);

    if (editedNormalized.text.length < MIN_EDITED_CHARS) {
      throw new Error("editor_output_too_short");
    }

    if (hasSectionMarkers(initialNormalized.text)) {
      const originalMarkerCount = countSectionMarkers(initialNormalized.text);
      const editedMarkerCount = countSectionMarkers(editedNormalized.text);
      if (editedMarkerCount < Math.ceil(originalMarkerCount * 0.5)) {
        throw new Error("editor_section_markers_lost");
      }
    }

    return {
      script: editedNormalized.text,
      edited: editedNormalized.text !== initialNormalized.text,
      enabled: true,
      model,
      error: null,
      normalizationMetrics: editedNormalized.metrics
    };
  } catch (error) {
    return {
      script: initialNormalized.text,
      edited: false,
      enabled: true,
      model,
      error: error instanceof Error ? error.message : String(error),
      normalizationMetrics: initialNormalized.metrics
    };
  }
};
