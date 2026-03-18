import { isDecisionOutcomeValue } from "@/app/lib/decisionHistory";
import { verifyCsrfOrigin } from "@/app/lib/csrf";
import { jsonResponse, checkRateLimit } from "@/app/lib/apiResponse";
import { generalLimiter, extractRateLimitKey } from "@/app/lib/rateLimit";
import { createUserClient } from "@/app/lib/supabaseClients";
import { getAccessTokenFromCookies, getViewerFromAccessToken } from "@/app/lib/viewer";

export const runtime = "nodejs";

type UpdateDecisionRequest = {
  outcome?: unknown;
};

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const rateLimitResponse = checkRateLimit(generalLimiter, extractRateLimitKey(request));
  if (rateLimitResponse) return rateLimitResponse;

  const csrf = verifyCsrfOrigin(request);
  if (!csrf.ok) {
    return jsonResponse({ ok: false, error: csrf.error }, 403);
  }

  const accessToken = await getAccessTokenFromCookies();
  const viewer = await getViewerFromAccessToken(accessToken);
  if (!viewer || !accessToken) {
    return jsonResponse({ ok: false, error: "unauthorized" }, 401);
  }

  const { id } = await params;
  if (!id.trim()) {
    return jsonResponse({ ok: false, error: "decision_id_required" }, 400);
  }

  const body = (await request.json().catch(() => ({}))) as UpdateDecisionRequest;
  if (!isDecisionOutcomeValue(body.outcome)) {
    return jsonResponse({ ok: false, error: "invalid_outcome" }, 400);
  }

  const supabase = createUserClient(accessToken);
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

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const rateLimitResponse = checkRateLimit(generalLimiter, extractRateLimitKey(request));
  if (rateLimitResponse) return rateLimitResponse;

  const csrf = verifyCsrfOrigin(request);
  if (!csrf.ok) {
    return jsonResponse({ ok: false, error: csrf.error }, 403);
  }

  const accessToken = await getAccessTokenFromCookies();
  const viewer = await getViewerFromAccessToken(accessToken);
  if (!viewer || !accessToken) {
    return jsonResponse({ ok: false, error: "unauthorized" }, 401);
  }

  const { id } = await params;
  if (!id.trim()) {
    return jsonResponse({ ok: false, error: "decision_id_required" }, 400);
  }

  const supabase = createUserClient(accessToken);
  const { data, error } = await supabase
    .from("user_decisions")
    .delete()
    .eq("id", id)
    .eq("user_id", viewer.userId)
    .select("id")
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
