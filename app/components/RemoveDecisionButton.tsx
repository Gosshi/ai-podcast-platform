"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { track } from "@/src/lib/analytics";
import styles from "./decision-history-controls.module.css";

type RemoveDecisionButtonProps = {
  decisionId: string;
  page: string;
  episodeId: string;
  judgmentCardId: string;
  genre: string | null;
  frameType: string | null;
  judgmentType: "use_now" | "watch" | "skip";
};

type RemoveDecisionResponse =
  | {
      ok: true;
      decision: {
        id: string;
      };
    }
  | {
      ok: false;
      error: string;
    };

export default function RemoveDecisionButton({
  decisionId,
  page,
  episodeId,
  judgmentCardId,
  genre,
  frameType,
  judgmentType
}: RemoveDecisionButtonProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onClick = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/decision-history/${decisionId}`, {
        method: "DELETE"
      });

      const payload = (await response.json().catch(() => null)) as RemoveDecisionResponse | null;
      if (!response.ok || !payload || !payload.ok) {
        setError("削除に失敗しました。");
        return;
      }

      track("decision_remove", {
        page,
        source: "history_remove_button",
        episode_id: episodeId,
        judgment_card_id: judgmentCardId,
        genre: genre ?? undefined,
        frame_type: frameType ?? undefined,
        judgment_type: judgmentType,
        decision_id: decisionId
      });
      router.refresh();
    } catch {
      setError("削除に失敗しました。");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={styles.actionRow}>
      <button type="button" className={styles.buttonDanger} onClick={() => void onClick()} disabled={isSubmitting}>
        {isSubmitting ? "削除中..." : "採用履歴から削除"}
      </button>
      {error ? <p className={styles.error} role="alert">{error}</p> : null}
    </div>
  );
}
