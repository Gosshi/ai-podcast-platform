import { getViewerFromCookies } from "@/app/lib/viewer";
import { createServiceRoleClient } from "@/app/lib/supabaseClients";

export const runtime = "nodejs";

const jsonResponse = (body: Record<string, unknown>, status = 200): Response => {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  });
};

const VALID_OUTCOMES = new Set(["success", "regret", "neutral"]);

type OutcomeRequest = {
  outcome?: unknown;
};

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const viewer = await getViewerFromCookies();
  if (!viewer) {
    return jsonResponse({ ok: false, error: "unauthorized" }, 401);
  }

  const body = (await request.json().catch(() => ({}))) as OutcomeRequest;
  const outcome = typeof body.outcome === "string" ? body.outcome.trim() : null;

  if (!outcome || !VALID_OUTCOMES.has(outcome)) {
    return jsonResponse({ ok: false, error: "invalid_outcome" }, 400);
  }

  const supabase = createServiceRoleClient();

  const { data, error } = await supabase
    .from("user_generated_cards")
    .update({ outcome })
    .eq("id", id)
    .eq("user_id", viewer.userId)
    .select("id, outcome")
    .single();

  if (error) {
    return jsonResponse({ ok: false, error: error.message }, 500);
  }

  if (!data) {
    return jsonResponse({ ok: false, error: "not_found" }, 404);
  }

  return jsonResponse({ ok: true, card: data });
}
