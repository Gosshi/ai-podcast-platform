"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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

const STATUS_BUTTONS: Array<{ status: WatchlistStatus; label: string }> = [
  { status: "saved", label: "Save" },
  { status: "watching", label: "Watch" }
];

const STATUS_HINTS: Record<WatchlistStatus, string> = {
  saved: "今は決めずに、あとで見返す候補として残します。",
  watching: "期限や条件変化を追いながら再訪する候補です。",
  archived: "今回は保留を閉じ、一覧には残したまま静かに保管します。"
};

const buildErrorMessage = (error: string, limit?: number): string => {
  if (error === "watchlist_limit_reached") {
    return `無料版の Watchlist は${limit ?? 5}件までです。続ける場合は有料会員へ切り替えてください。`;
  }

  if (error === "unauthorized") {
    return "Watchlist を使うにはログインが必要です。";
  }

  return "Watchlist の更新に失敗しました。時間をおいて再度お試しください。";
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
  compact = false
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
      router.push("/account");
      return;
    }

    if (!judgmentCardId) {
      setError("対象の judgment card が見つかりません。");
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
      track("watchlist_add", {
        ...analyticsProps,
        watchlist_status: payload.item.status ?? previousStatus ?? undefined,
        previous_status: previousStatus ?? undefined,
        action: itemId ? "status_update" : "create"
      });
      router.refresh();
    } catch {
      setError("Watchlist の更新に失敗しました。時間をおいて再度お試しください。");
    } finally {
      setIsSubmitting(false);
    }
  };

  const removeItem = async () => {
    if (!viewer) {
      router.push("/account");
      return;
    }

    if (!itemId) {
      setStatus(null);
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/watchlist/${itemId}`, {
        method: "DELETE"
      });
      const payload = (await response.json().catch(() => null)) as WatchlistApiResponse | null;

      if (!response.ok || !payload || !payload.ok) {
        setError("Watchlist からの削除に失敗しました。");
        return;
      }

      const previousStatus = status;
      setItemId(null);
      setStatus(null);
      track("watchlist_remove", {
        ...analyticsProps,
        previous_status: previousStatus ?? undefined,
        watchlist_item_id: itemId
      });
      router.refresh();
    } catch {
      setError("Watchlist からの削除に失敗しました。");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!viewer) {
    return (
      <div className={`${styles.shell} ${compact ? styles.shellCompact : ""}`.trim()}>
        <button
          type="button"
          className={`${styles.button} ${styles.buttonGhost}`.trim()}
          onClick={() => router.push("/account")}
        >
          ログインして Save / Watch
        </button>
      </div>
    );
  }

  return (
    <div className={`${styles.shell} ${compact ? styles.shellCompact : ""}`.trim()}>
      <div className={styles.row}>
        {STATUS_BUTTONS.map((item) => (
          <button
            key={item.status}
            type="button"
            className={`${styles.button} ${status === item.status ? styles.buttonActive : ""}`.trim()}
            onClick={() => void upsertStatus(item.status)}
            disabled={isSubmitting}
          >
            {item.label}
          </button>
        ))}
        {itemId ? (
          <button
            type="button"
            className={`${styles.button} ${status === "archived" ? styles.buttonMutedActive : styles.buttonMuted}`.trim()}
            onClick={() => void upsertStatus("archived")}
            disabled={isSubmitting}
          >
            Archive
          </button>
        ) : null}
        {itemId ? (
          <button type="button" className={styles.buttonDanger} onClick={() => void removeItem()} disabled={isSubmitting}>
            Remove
          </button>
        ) : null}
      </div>

      {!compact ? <p className={styles.hint}>{status ? STATUS_HINTS[status] : STATUS_HINTS.saved}</p> : null}
      {error ? <p className={styles.error}>{error}</p> : null}
    </div>
  );
}
