"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { buildLoginPath } from "@/app/lib/onboarding";
import type { ViewerState } from "@/app/lib/viewer";
import { track } from "@/src/lib/analytics";
import styles from "./decision-history-controls.module.css";

type SaveDecisionButtonProps = {
  judgmentCardId: string | undefined;
  viewer: ViewerState | null;
  initialSaved: boolean;
  page?: string;
  source?: string;
  episodeId?: string;
  genre?: string | null;
  frameType?: string | null;
  judgmentType?: "use_now" | "watch" | "skip";
  buttonLabel?: string;
  loginButtonLabel?: string;
  showHint?: boolean;
};

type SaveDecisionResponse =
  | {
      ok: true;
      decision: {
        id: string;
        outcome: string | null;
        alreadySaved: boolean;
      };
    }
  | {
      ok: false;
      error: string;
      limit?: number;
    };

export default function SaveDecisionButton({
  judgmentCardId,
  viewer,
  initialSaved,
  page,
  source = "save_decision_button",
  episodeId,
  genre,
  frameType,
  judgmentType,
  buttonLabel,
  loginButtonLabel,
  showHint = true
}: SaveDecisionButtonProps) {
  const router = useRouter();
  const [isSaved, setIsSaved] = useState(initialSaved);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIsSaved(initialSaved);
  }, [initialSaved]);

  const onClick = async () => {
    if (!judgmentCardId) {
      setError("保存対象のトピックが見つかりません。");
      return;
    }

    if (!viewer) {
      router.push(buildLoginPath(page ?? "/decisions"));
      return;
    }

    if (isSaved) {
      router.push("/history");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/decision-history", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          judgmentCardId
        })
      });

      const payload = (await response.json().catch(() => null)) as SaveDecisionResponse | null;
      if (!response.ok || !payload || !payload.ok) {
        const apiError = payload && !payload.ok ? payload.error : "save_failed";
        if (apiError === "history_limit_reached") {
          setError(`無料版の履歴保存は10件までです。続ける場合は有料会員へ切り替えてください。`);
        } else if (apiError === "unauthorized") {
          setError("保存するにはログインが必要です。");
        } else {
          setError("保存に失敗しました。時間をおいて再度お試しください。");
        }
        return;
      }

      setIsSaved(true);
      track("decision_action_click", {
        page,
        source,
        action_name: "save_decision",
        episode_id: episodeId,
        judgment_card_id: judgmentCardId,
        genre: genre ?? undefined,
        frame_type: frameType ?? undefined,
        judgment_type: judgmentType
      });
      track("decision_save", {
        page,
        source,
        episode_id: episodeId,
        judgment_card_id: judgmentCardId,
        genre: genre ?? undefined,
        frame_type: frameType ?? undefined,
        judgment_type: judgmentType
      });
      router.refresh();
    } catch {
      setError("保存に失敗しました。時間をおいて再度お試しください。");
    } finally {
      setIsSubmitting(false);
    }
  };

  const buttonClassName = `${styles.button} ${isSaved ? styles.buttonSaved : ""} ${
    !viewer ? styles.buttonGhost : ""
  }`.trim();
  const resolvedButtonLabel = viewer ? buttonLabel ?? "採用する" : loginButtonLabel ?? "ログインして採用する";
  const savedStateLabel = "結果を記録する";

  return (
    <div className={styles.actionRow}>
      <button type="button" className={buttonClassName} onClick={() => void onClick()} disabled={isSubmitting}>
        {isSubmitting ? "保存中..." : isSaved ? savedStateLabel : resolvedButtonLabel}
      </button>
      {showHint ? (
        <p className={styles.hint}>{isSaved ? "履歴で結果を更新できます。" : "採用したアクションをあとで振り返れます。"}</p>
      ) : null}
      {error ? <p className={styles.error}>{error}</p> : null}
    </div>
  );
}
