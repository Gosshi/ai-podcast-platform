import { createServiceRoleClient } from "@/app/lib/supabaseClients";

export const runtime = "nodejs";

type RequestBody = {
  display_name?: unknown;
  displayName?: unknown;
  text?: unknown;
};

type ValidationErrors = Partial<Record<"display_name" | "text", string>>;
type TextViolationCode =
  | "ng_word"
  | "url"
  | "repeated_characters"
  | "duplicate_lines"
  | "excessive_symbols";

const DISPLAY_NAME_MAX = 40;
const TEXT_MAX = 700;
const RATE_LIMIT_WINDOW_MS = 90 * 1000;
const NG_WORDS = ["死ね", "殺す", "fuck", "shit", "viagra", "casino"];
const URL_PATTERN = /https?:\/\/|www\./i;
const REPEATED_CHARACTER_PATTERN = /(.)\1{7,}/u;
const REPEATED_SYMBOL_PATTERN = /[!?！？。、.,~〜]{6,}/u;
const SYMBOL_PATTERN = /[!?！？。、.,~〜@#$%^&*_=+|\\/<>[\]{}()]/g;

const jsonResponse = (body: Record<string, unknown>, status = 200): Response => {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json"
    }
  });
};

const toNonEmptyString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const includesNgWord = (value: string): boolean => {
  const lowerValue = value.toLowerCase();
  return NG_WORDS.some((word) => lowerValue.includes(word.toLowerCase()));
};

const hasDuplicateLines = (value: string): boolean => {
  const lines = value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length < 3) {
    return false;
  }

  return new Set(lines).size === 1;
};

const hasExcessiveSymbols = (value: string): boolean => {
  const symbolMatches = value.match(SYMBOL_PATTERN) ?? [];
  if (symbolMatches.length === 0) {
    return false;
  }

  if (REPEATED_SYMBOL_PATTERN.test(value)) {
    return true;
  }

  const symbolRatio = symbolMatches.length / value.length;
  return value.length >= 20 && symbolRatio > 0.35;
};

const detectTextViolation = (value: string): TextViolationCode | null => {
  if (includesNgWord(value)) return "ng_word";
  if (URL_PATTERN.test(value)) return "url";
  if (REPEATED_CHARACTER_PATTERN.test(value)) return "repeated_characters";
  if (hasDuplicateLines(value)) return "duplicate_lines";
  if (hasExcessiveSymbols(value)) return "excessive_symbols";
  return null;
};

const toViolationMessage = (code: TextViolationCode): string => {
  switch (code) {
    case "ng_word":
      return "本文に利用できない表現が含まれています";
    case "url":
      return "URLを含む本文は投稿できません";
    case "repeated_characters":
    case "duplicate_lines":
      return "同一内容の連続投稿と判定されました。表現を変えて再投稿してください";
    case "excessive_symbols":
      return "記号が多すぎるため投稿できません";
    default:
      return "投稿内容を確認してください";
  }
};

const validateInput = (displayName: string | null, text: string | null): ValidationErrors => {
  const errors: ValidationErrors = {};

  if (!displayName) {
    errors.display_name = "表示名は必須です";
  } else if (displayName.length > DISPLAY_NAME_MAX) {
    errors.display_name = `表示名は${DISPLAY_NAME_MAX}文字以内で入力してください`;
  } else if (includesNgWord(displayName)) {
    errors.display_name = "表示名に利用できない表現が含まれています";
  }

  if (!text) {
    errors.text = "お便り本文は必須です";
  } else if (text.length > TEXT_MAX) {
    errors.text = `本文は${TEXT_MAX}文字以内で入力してください`;
  } else {
    const violation = detectTextViolation(text);
    if (violation) {
      errors.text = toViolationMessage(violation);
    }
  }

  return errors;
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as RequestBody;
  const displayName = toNonEmptyString(body.display_name ?? body.displayName);
  const text = toNonEmptyString(body.text);

  const validationErrors = validateInput(displayName, text);
  if (Object.keys(validationErrors).length > 0) {
    return jsonResponse(
      {
        ok: false,
        error: "validation_error",
        fields: validationErrors
      },
      400
    );
  }

  let supabase;
  try {
    supabase = createServiceRoleClient();
  } catch (error) {
    const message = error instanceof Error ? error.message : "supabase_config_error";
    return jsonResponse({ ok: false, error: message }, 500);
  }

  const recentThreshold = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();
  const { data: recentLetter, error: recentQueryError } = await supabase
    .from("letters")
    .select("id")
    .eq("display_name", displayName)
    .gte("created_at", recentThreshold)
    .limit(1)
    .maybeSingle();

  if (recentQueryError) {
    return jsonResponse({ ok: false, error: recentQueryError.message }, 500);
  }

  if (recentLetter) {
    return jsonResponse(
      {
        ok: false,
        error: "rate_limited",
        fields: {
          display_name: "短時間での連続投稿はできません。しばらく待ってから再投稿してください"
        }
      },
      429
    );
  }

  const { data, error } = await supabase
    .from("letters")
    .insert({
      display_name: displayName,
      text
    })
    .select("id, display_name, text, created_at")
    .single();

  if (error || !data) {
    return jsonResponse({ ok: false, error: error?.message ?? "insert_failed" }, 500);
  }

  return jsonResponse({ ok: true, letter: data }, 201);
}
