import { countActiveWatchlistItems } from "@/app/lib/watchlist";
import { verifyCsrfOrigin } from "@/app/lib/csrf";
import { createServiceRoleClient } from "@/app/lib/supabaseClients";
import { getViewerFromCookies } from "@/app/lib/viewer";
import {
  FREE_WATCHLIST_LIMIT,
  hasReachedWatchlistLimit,
  isWatchlistStatus
} from "@/src/lib/watchlist";

export const runtime = "nodejs";

type UpdateWatchlistRequest = {
  status?: unknown;
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
  const csrf = verifyCsrfOrigin(request);
  if (!csrf.ok) {
    return jsonResponse({ ok: false, error: csrf.error }, 403);
  }

  const viewer = await getViewerFromCookies();
  if (!viewer) {
    return jsonResponse({ ok: false, error: "unauthorized" }, 401);
  }

  const { id } = await params;
  if (!id.trim()) {
    return jsonResponse({ ok: false, error: "watchlist_item_id_required" }, 400);
  }

  const body = (await request.json().catch(() => ({}))) as UpdateWatchlistRequest;
  if (!isWatchlistStatus(body.status)) {
    return jsonResponse({ ok: false, error: "invalid_status" }, 400);
  }

  const supabase = createServiceRoleClient();
  const { data: existingItem, error: existingItemError } = await supabase
    .from("user_watchlist_items")
    .select("id, status")
    .eq("id", id)
    .eq("user_id", viewer.userId)
    .maybeSingle();

  if (existingItemError) {
    return jsonResponse({ ok: false, error: existingItemError.message }, 500);
  }

  if (!existingItem) {
    return jsonResponse({ ok: false, error: "watchlist_item_not_found" }, 404);
  }

  if (
    !viewer.isPaid &&
    body.status !== "archived" &&
    existingItem.status === "archived"
  ) {
    const { count, error } = await countActiveWatchlistItems(viewer.userId);
    if (error) {
      return jsonResponse({ ok: false, error }, 500);
    }

    if (hasReachedWatchlistLimit(count, viewer.isPaid)) {
      return jsonResponse(
        {
          ok: false,
          error: "watchlist_limit_reached",
          limit: FREE_WATCHLIST_LIMIT
        },
        403
      );
    }
  }

  const { data, error } = await supabase
    .from("user_watchlist_items")
    .update({
      status: body.status
    })
    .eq("id", id)
    .eq("user_id", viewer.userId)
    .select("id, judgment_card_id, episode_id, status, created_at, updated_at")
    .maybeSingle();

  if (error) {
    return jsonResponse({ ok: false, error: error.message }, 500);
  }

  if (!data) {
    return jsonResponse({ ok: false, error: "watchlist_item_not_found" }, 404);
  }

  return jsonResponse({
    ok: true,
    item: data
  });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const csrf = verifyCsrfOrigin(request);
  if (!csrf.ok) {
    return jsonResponse({ ok: false, error: csrf.error }, 403);
  }

  const viewer = await getViewerFromCookies();
  if (!viewer) {
    return jsonResponse({ ok: false, error: "unauthorized" }, 401);
  }

  const { id } = await params;
  if (!id.trim()) {
    return jsonResponse({ ok: false, error: "watchlist_item_id_required" }, 400);
  }

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("user_watchlist_items")
    .delete()
    .eq("id", id)
    .eq("user_id", viewer.userId)
    .select("id")
    .maybeSingle();

  if (error) {
    return jsonResponse({ ok: false, error: error.message }, 500);
  }

  if (!data) {
    return jsonResponse({ ok: false, error: "watchlist_item_not_found" }, 404);
  }

  return jsonResponse({
    ok: true,
    item: data
  });
}
