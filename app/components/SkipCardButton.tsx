"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { buildLoginPath } from "@/app/lib/onboarding";
import type { ViewerState } from "@/app/lib/viewer";
import { track } from "@/src/lib/analytics";
import type { JudgmentType } from "@/src/lib/judgmentCards";
import type { WatchlistStatus } from "@/src/lib/watchlist";
import styles from "./watchlist-controls.module.css";

type SkipCardButtonProps = {
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
};

export default function SkipCardButton({
  judgmentCardId,
  viewer,
  initialItemId,
  initialStatus,
  page,
  source,
  episodeId,
  genre,
  frameType,
  judgmentType
}: SkipCardButtonProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSkipped, setIsSkipped] = useState(initialStatus === "archived");
  const [error, setError] = useState<string | null>(null);

  const skip = async () => {
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
      const response = await fetch(
        initialItemId ? `/api/watchlist/${initialItemId}` : "/api/watchlist",
        {
          method: initialItemId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            initialItemId
              ? { status: "archived" }
              : { judgmentCardId, status: "archived" }
          )
        }
      );

      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) {
        setError("見送りの保存に失敗しました。時間をおいて再度お試しください。");
        return;
      }

      setIsSkipped(true);
      track("decision_action_click", {
        page,
        source,
        action_name: "archived",
        episode_id: episodeId,
        judgment_card_id: judgmentCardId,
        genre: genre ?? undefined,
        frame_type: frameType ?? undefined,
        judgment_type: judgmentType
      });
      router.refresh();
    } catch {
      setError("見送りの保存に失敗しました。時間をおいて再度お試しください。");
    } finally {
      setIsSubmitting(false);
    }
  };

  const buttonClass = `${styles.button} ${
    isSkipped ? styles.buttonMutedActive : styles.buttonMuted
  } ${!viewer ? styles.buttonGhost : ""}`.trim();

  return (
    <div>
      <button
        type="button"
        className={buttonClass}
        onClick={() => void skip()}
        disabled={isSubmitting || isSkipped}
        aria-pressed={isSkipped}
      >
        {isSubmitting ? "保存中..." : isSkipped ? "見送り済み" : viewer ? "見送る" : "ログインして見送る"}
      </button>
      {error ? <p className={styles.error} role="alert">{error}</p> : null}
    </div>
  );
}
