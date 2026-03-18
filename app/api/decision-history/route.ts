import { FREE_DECISION_HISTORY_LIMIT } from "@/app/lib/decisionHistory";
import { verifyCsrfOrigin } from "@/app/lib/csrf";
import { getViewerFromCookies } from "@/app/lib/viewer";
import { createServiceRoleClient } from "@/app/lib/supabaseClients";

export const runtime = "nodejs";

type SaveDecisionRequest = {
  judgmentCardId?: unknown;
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
  const csrf = verifyCsrfOrigin(request);
  if (!csrf.ok) {
    return jsonResponse({ ok: false, error: csrf.error }, 403);
  }

  const viewer = await getViewerFromCookies();
  if (!viewer) {
    return jsonResponse({ ok: false, error: "unauthorized" }, 401);
  }

  const body = (await request.json().catch(() => ({}))) as SaveDecisionRequest;
  const judgmentCardId = toNonEmptyString(body.judgmentCardId);
  if (!judgmentCardId) {
    return jsonResponse({ ok: false, error: "judgment_card_id_required" }, 400);
  }

  const supabase = createServiceRoleClient();

  const { data: existingDecision, error: existingDecisionError } = await supabase
    .from("user_decisions")
    .select("id, outcome")
    .eq("user_id", viewer.userId)
    .eq("judgment_card_id", judgmentCardId)
    .maybeSingle();

  if (existingDecisionError) {
    return jsonResponse({ ok: false, error: existingDecisionError.message }, 500);
  }

  if (existingDecision) {
    return jsonResponse({
      ok: true,
      decision: {
        id: existingDecision.id,
        outcome: existingDecision.outcome,
        alreadySaved: true
      }
    });
  }

  if (!viewer.isPaid) {
    const { count, error: countError } = await supabase
      .from("user_decisions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", viewer.userId);

    if (countError) {
      return jsonResponse({ ok: false, error: countError.message }, 500);
    }

    if ((count ?? 0) >= FREE_DECISION_HISTORY_LIMIT) {
      return jsonResponse(
        {
          ok: false,
          error: "history_limit_reached",
          limit: FREE_DECISION_HISTORY_LIMIT
        },
        403
      );
    }
  }

  const { data: judgmentCard, error: judgmentCardError } = await supabase
    .from("episode_judgment_cards")
    .select("id, episode_id, judgment_type")
    .eq("id", judgmentCardId)
    .maybeSingle();

  if (judgmentCardError) {
    return jsonResponse({ ok: false, error: judgmentCardError.message }, 500);
  }

  if (!judgmentCard) {
    return jsonResponse({ ok: false, error: "judgment_card_not_found" }, 404);
  }

  const { data: insertedDecision, error: insertError } = await supabase
    .from("user_decisions")
    .insert({
      user_id: viewer.userId,
      judgment_card_id: judgmentCard.id,
      episode_id: judgmentCard.episode_id,
      decision_type: judgmentCard.judgment_type
    })
    .select("id, outcome")
    .single();

  if (insertError || !insertedDecision) {
    return jsonResponse({ ok: false, error: insertError?.message ?? "insert_failed" }, 500);
  }

  return jsonResponse(
    {
      ok: true,
      decision: {
        id: insertedDecision.id,
        outcome: insertedDecision.outcome,
        alreadySaved: false
      }
    },
    201
  );
}
