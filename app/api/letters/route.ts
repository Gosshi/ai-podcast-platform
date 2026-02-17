import { createServiceRoleClient } from "@/app/lib/supabaseClients";

export const runtime = "nodejs";

type RequestBody = {
  displayName?: unknown;
  text?: unknown;
};

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

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as RequestBody;
  const displayName = toNonEmptyString(body.displayName);
  const text = toNonEmptyString(body.text);

  if (!displayName || !text) {
    return jsonResponse({ ok: false, error: "displayName and text are required" }, 400);
  }

  let supabase;
  try {
    supabase = createServiceRoleClient();
  } catch (error) {
    const message = error instanceof Error ? error.message : "supabase_config_error";
    return jsonResponse({ ok: false, error: message }, 500);
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
