import { createServiceRoleClient } from "@/app/lib/supabaseClients";

export const runtime = "nodejs";

type RequestBody = {
  display_name?: unknown;
  displayName?: unknown;
  text?: unknown;
};

type ValidationErrors = Partial<Record<"display_name" | "text", string>>;

const DISPLAY_NAME_MAX = 40;
const TEXT_MAX = 700;
const RATE_LIMIT_WINDOW_MS = 90 * 1000;
const NG_WORDS = ["死ね", "殺す", "fuck", "shit", "viagra", "casino"];

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
  } else if (includesNgWord(text)) {
    errors.text = "本文に利用できない表現が含まれています";
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
