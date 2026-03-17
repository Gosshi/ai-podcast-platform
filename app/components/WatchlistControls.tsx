"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { buildLoginPath } from "@/app/lib/onboarding";
import type { ViewerState } from "@/app/lib/viewer";
import { track } from "@/src/lib/analytics";
import type { JudgmentType } from "@/src/lib/judgmentCards";
import type { WatchlistStatus } from "@/src/lib/watchlist";
import styles from "./watchlist-controls.module.css";

type WatchlistControlsProps = {
  judgmentCardId: string | undefined;
  viewer: ViewerState | null;
  initialItemId: string | null;
  initialStatus: WatchlistStatus | null;
  page: string;
  source: string;
  episodeId?: string;
  genre?: string | null;
  frameType?: string | null;
  judgmentType?: JudgmentType;
  compact?: boolean;
  savedLabel?: string;
  archivedLabel?: string;
  showHint?: boolean;
};

type WatchlistApiSuccess = {
  ok: true;
  item: {
    id: string;
    status?: WatchlistStatus;
    created_at?: string;
    updated_at?: string;
    previousStatus?: WatchlistStatus | null;
    alreadySaved?: boolean;
  };
};

type WatchlistApiFailure = {
  ok: false;
  error: string;
  limit?: number;
};

type WatchlistApiResponse = WatchlistApiSuccess | WatchlistApiFailure;

const STATUS_HINTS: Record<WatchlistStatus, string> = {
  saved: "後で考えるトピックとして保存します。",
  watching: "後で考えるトピックとして保存します。",
  archived: "今回は見送るトピックとして整理します。"
};

const buildErrorMessage = (error: string, limit?: number): string => {
  if (error === "watchlist_limit_reached") {
    return `無料版で保存できるのは${limit ?? 5}件までです。続ける場合は有料会員へ切り替えてください。`;
  }

  if (error === "unauthorized") {
    return "更新するにはログインが必要です。";
  }

  return "保存状態の更新に失敗しました。時間をおいて再度お試しください。";
};

export default function WatchlistControls({
  judgmentCardId,
  viewer,
  initialItemId,
  initialStatus,
  page,
  source,
  episodeId,
  genre,
  frameType,
  judgmentType,
  compact = false,
  savedLabel = "保存",
  archivedLabel = "見送る",
  showHint = true
}: WatchlistControlsProps) {
  const router = useRouter();
  const [itemId, setItemId] = useState(initialItemId);
  const [status, setStatus] = useState<WatchlistStatus | null>(initialStatus);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setItemId(initialItemId);
    setStatus(initialStatus);
  }, [initialItemId, initialStatus]);

  const analyticsProps = {
    page,
    source,
    episode_id: episodeId,
    judgment_card_id: judgmentCardId,
    genre: genre ?? undefined,
    frame_type: frameType ?? undefined,
    judgment_type: judgmentType
  };

  const upsertStatus = async (nextStatus: WatchlistStatus) => {
    if (!viewer) {
      router.push(buildLoginPath(page));
      return;
    }

    if (!judgmentCardId) {
      setError("対象のトピックカードが見つかりません。");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(itemId ? `/api/watchlist/${itemId}` : "/api/watchlist", {
        method: itemId ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(
          itemId
            ? {
                status: nextStatus
              }
            : {
                judgmentCardId,
                status: nextStatus
              }
        )
      });

      const payload = (await response.json().catch(() => null)) as WatchlistApiResponse | null;
      if (!response.ok || !payload || !payload.ok) {
        const apiError = payload && !payload.ok ? payload.error : "watchlist_update_failed";
        const limit = payload && !payload.ok ? payload.limit : undefined;
        setError(buildErrorMessage(apiError, limit));
        return;
      }

      const previousStatus = status;
      setItemId(payload.item.id);
      setStatus(payload.item.status ?? previousStatus);
      track("decision_action_click", {
        ...analyticsProps,
        action_name: nextStatus,
        previous_status: previousStatus ?? undefined
      });
      if (nextStatus === "archived") {
        track("watchlist_remove", {
          ...analyticsProps,
          previous_status: previousStatus ?? undefined,
          watchlist_item_id: payload.item.id
        });
      } else {
        track("watchlist_add", {
          ...analyticsProps,
          watchlist_status: payload.item.status ?? previousStatus ?? undefined,
          previous_status: previousStatus ?? undefined,
          action: itemId ? "status_update" : "create"
        });
      }
      router.refresh();
    } catch {
      setError("保存状態の更新に失敗しました。時間をおいて再度お試しください。");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={`${styles.shell} ${compact ? styles.shellCompact : ""}`.trim()}>
      <div className={styles.row}>
        <button
          type="button"
          className={`${styles.button} ${
            status === "saved" || status === "watching" ? styles.buttonActive : !viewer ? styles.buttonGhost : ""
          }`.trim()}
          onClick={() => void (viewer ? upsertStatus("saved") : router.push(buildLoginPath(page)))}
          disabled={isSubmitting}
        >
          {viewer ? savedLabel : `ログインして${savedLabel}`}
        </button>
        <button
          type="button"
          className={`${styles.button} ${
            status === "archived" ? styles.buttonMutedActive : styles.buttonMuted
          } ${!viewer ? styles.buttonGhost : ""}`.trim()}
          onClick={() => void (viewer ? upsertStatus("archived") : router.push(buildLoginPath(page)))}
          disabled={isSubmitting}
        >
          {viewer ? archivedLabel : `ログインして${archivedLabel}`}
        </button>
      </div>

      {!compact && showHint ? (
        <p className={styles.hint}>
          {status === "archived"
            ? STATUS_HINTS.archived
            : status
              ? STATUS_HINTS[status]
              : STATUS_HINTS.saved}
        </p>
      ) : null}
      {error ? <p className={styles.error}>{error}</p> : null}
    </div>
  );
}
