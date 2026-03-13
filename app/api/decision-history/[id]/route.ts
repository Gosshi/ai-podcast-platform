import { isDecisionOutcome } from "@/app/lib/decisionHistory";
import { createServiceRoleClient } from "@/app/lib/supabaseClients";
import { getViewerFromCookies } from "@/app/lib/viewer";

export const runtime = "nodejs";

type UpdateDecisionRequest = {
  outcome?: unknown;
};

const jsonResponse = (body: Record<string, unknown>, status = 200): Response => {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json"
    }
  });
};

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const viewer = await getViewerFromCookies();
  if (!viewer) {
    return jsonResponse({ ok: false, error: "unauthorized" }, 401);
  }

  const { id } = await params;
  if (!id.trim()) {
    return jsonResponse({ ok: false, error: "decision_id_required" }, 400);
  }

  const body = (await request.json().catch(() => ({}))) as UpdateDecisionRequest;
  if (!isDecisionOutcome(body.outcome)) {
    return jsonResponse({ ok: false, error: "invalid_outcome" }, 400);
  }

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("user_decisions")
    .update({
      outcome: body.outcome
    })
    .eq("id", id)
    .eq("user_id", viewer.userId)
    .select("id, outcome, updated_at")
    .maybeSingle();

  if (error) {
    return jsonResponse({ ok: false, error: error.message }, 500);
  }

  if (!data) {
    return jsonResponse({ ok: false, error: "decision_not_found" }, 404);
  }

  return jsonResponse({
    ok: true,
    decision: data
  });
}
