import { countActiveWatchlistItems } from "@/app/lib/watchlist";
import { verifyCsrfOrigin } from "@/app/lib/csrf";
import { jsonResponse, toNonEmptyString, checkRateLimit } from "@/app/lib/apiResponse";
import { generalLimiter, extractRateLimitKey } from "@/app/lib/rateLimit";
import { createUserClient } from "@/app/lib/supabaseClients";
import { getAccessTokenFromCookies, getViewerFromAccessToken } from "@/app/lib/viewer";
import {
  FREE_WATCHLIST_LIMIT,
  hasReachedWatchlistLimit,
  isWatchlistStatus,
  type WatchlistStatus
} from "@/src/lib/watchlist";

export const runtime = "nodejs";

type CreateWatchlistRequest = {
  judgmentCardId?: unknown;
  status?: unknown;
};

const resolveRequestedStatus = (value: unknown): WatchlistStatus | null => {
  return isWatchlistStatus(value) ? value : null;
};

export async function POST(request: Request) {
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

  const body = (await request.json().catch(() => ({}))) as CreateWatchlistRequest;
  const judgmentCardId = toNonEmptyString(body.judgmentCardId);
  const requestedStatus = resolveRequestedStatus(body.status);

  if (!judgmentCardId) {
    return jsonResponse({ ok: false, error: "judgment_card_id_required" }, 400);
  }

  if (!requestedStatus) {
    return jsonResponse({ ok: false, error: "invalid_status" }, 400);
  }

  const supabase = createUserClient(accessToken);
  const { data: existingItem, error: existingItemError } = await supabase
    .from("user_watchlist_items")
    .select("id, status, created_at, updated_at")
    .eq("user_id", viewer.userId)
    .eq("judgment_card_id", judgmentCardId)
    .maybeSingle();

  if (existingItemError) {
    return jsonResponse({ ok: false, error: existingItemError.message }, 500);
  }

  if (existingItem) {
    if (
      !viewer.isPaid &&
      requestedStatus !== "archived" &&
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

    const { data: updatedItem, error: updateError } = await supabase
      .from("user_watchlist_items")
      .update({
        status: requestedStatus
      })
      .eq("id", existingItem.id)
      .eq("user_id", viewer.userId)
      .select("id, judgment_card_id, episode_id, status, created_at, updated_at")
      .maybeSingle();

    if (updateError || !updatedItem) {
      return jsonResponse({ ok: false, error: updateError?.message ?? "update_failed" }, 500);
    }

    return jsonResponse({
      ok: true,
      item: {
        ...updatedItem,
        alreadySaved: true,
        previousStatus: existingItem.status
      }
    });
  }

  if (!viewer.isPaid && requestedStatus !== "archived") {
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

  const { data: judgmentCard, error: judgmentCardError } = await supabase
    .from("episode_judgment_cards")
    .select("id, episode_id")
    .eq("id", judgmentCardId)
    .maybeSingle();

  if (judgmentCardError) {
    return jsonResponse({ ok: false, error: judgmentCardError.message }, 500);
  }

  if (!judgmentCard) {
    return jsonResponse({ ok: false, error: "judgment_card_not_found" }, 404);
  }

  const { data: insertedItem, error: insertError } = await supabase
    .from("user_watchlist_items")
    .insert({
      user_id: viewer.userId,
      judgment_card_id: judgmentCard.id,
      episode_id: judgmentCard.episode_id,
      status: requestedStatus
    })
    .select("id, judgment_card_id, episode_id, status, created_at, updated_at")
    .single();

  if (insertError || !insertedItem) {
    return jsonResponse({ ok: false, error: insertError?.message ?? "insert_failed" }, 500);
  }

  return jsonResponse(
    {
      ok: true,
      item: {
        ...insertedItem,
        alreadySaved: false,
        previousStatus: null
      }
    },
    201
  );
}
