import { verifyCsrfOrigin } from "@/app/lib/csrf";
import { jsonResponse, checkRateLimit } from "@/app/lib/apiResponse";
import { generalLimiter, extractRateLimitKey } from "@/app/lib/rateLimit";
import { getAccessTokenFromCookies, getViewerFromAccessToken } from "@/app/lib/viewer";
import { createUserClient } from "@/app/lib/supabaseClients";

export const runtime = "nodejs";

const VALID_OUTCOMES = new Set(["success", "regret", "neutral"]);

type OutcomeRequest = {
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

  const { id } = await params;

  const accessToken = await getAccessTokenFromCookies();
  const viewer = await getViewerFromAccessToken(accessToken);
  if (!viewer || !accessToken) {
    return jsonResponse({ ok: false, error: "unauthorized" }, 401);
  }

  const body = (await request.json().catch(() => ({}))) as OutcomeRequest;
  const outcome = typeof body.outcome === "string" ? body.outcome.trim() : null;

  if (!outcome || !VALID_OUTCOMES.has(outcome)) {
    return jsonResponse({ ok: false, error: "invalid_outcome" }, 400);
  }

  const supabase = createUserClient(accessToken);

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
