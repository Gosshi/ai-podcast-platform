"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  OUTCOME_LABELS,
  type DecisionOutcome,
  type DecisionOutcomeValue
} from "@/app/lib/decisionHistory";
import { track } from "@/src/lib/analytics";
import styles from "./decision-history-controls.module.css";

type DecisionOutcomeSelectProps = {
  decisionId: string;
  initialOutcome: DecisionOutcome;
  page?: string;
  source?: string;
  episodeId?: string;
  judgmentCardId?: string;
  genre?: string | null;
  frameType?: string | null;
  judgmentType?: "use_now" | "watch" | "skip";
  variant?: "select" | "quick";
  apiBasePath?: string;
};

type UpdateDecisionResponse =
  | {
      ok: true;
      decision: {
        id: string;
        outcome: DecisionOutcomeValue;
        updated_at: string;
      };
    }
  | {
      ok: false;
      error: string;
    };

const OUTCOME_OPTIONS: DecisionOutcomeValue[] = ["success", "neutral", "regret"];

export default function DecisionOutcomeSelect({
  decisionId,
  initialOutcome,
  page,
  source,
  episodeId,
  judgmentCardId,
  genre,
  frameType,
  judgmentType,
  variant = "select",
  apiBasePath
}: DecisionOutcomeSelectProps) {
  const router = useRouter();
  const [value, setValue] = useState<DecisionOutcome>(initialOutcome);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onChange = async (nextValue: DecisionOutcomeValue) => {
    const previousValue = value;
    setValue(nextValue);
    setError(null);
    setIsSubmitting(true);

    try {
      const basePath = apiBasePath ?? "/api/decision-history";
      const response = await fetch(`${basePath}/${decisionId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          outcome: nextValue
        })
      });

      const payload = (await response.json().catch(() => null)) as UpdateDecisionResponse | null;
      if (!response.ok || !payload || !payload.ok) {
        setValue(previousValue);
        setError("結果の更新に失敗しました。");
        return;
      }

      track("outcome_update", {
        page,
        source: source ?? (variant === "quick" ? "outcome_reminder_quick_submit" : "history_outcome_select"),
        decision_id: decisionId,
        episode_id: episodeId,
        judgment_card_id: judgmentCardId,
        genre: genre ?? undefined,
        frame_type: frameType ?? undefined,
        judgment_type: judgmentType,
        previous_outcome: previousValue,
        outcome: nextValue
      });

      if (variant === "quick") {
        track("outcome_quick_submit", {
          page,
          source: source ?? "outcome_reminder_quick_submit",
          decision_id: decisionId,
          episode_id: episodeId,
          judgment_card_id: judgmentCardId,
          genre: genre ?? undefined,
          frame_type: frameType ?? undefined,
          judgment_type: judgmentType,
          previous_outcome: previousValue,
          outcome: nextValue
        });
      }

      router.refresh();
    } catch {
      setValue(previousValue);
      setError("結果の更新に失敗しました。");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (variant === "quick") {
    return (
      <div className={styles.quickOutcomeStack}>
        <div className={styles.quickOutcomeGroup} role="group" aria-label="結果をすばやく記録">
          {OUTCOME_OPTIONS.map((outcome) => (
            <button
              key={outcome}
              type="button"
              className={`${styles.quickOutcomeButton} ${
                value === outcome ? styles.quickOutcomeButtonActive : ""
              } ${styles[`quickOutcomeButton_${outcome}`]}`.trim()}
              onClick={() => void onChange(outcome)}
              disabled={isSubmitting}
              aria-pressed={value === outcome}
            >
              {isSubmitting && value === outcome ? "保存中..." : OUTCOME_LABELS[outcome]}
            </button>
          ))}
        </div>
        {error ? <p className={styles.error} role="alert">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className={styles.actionRow}>
      <select
        className={styles.select}
        value={value ?? ""}
        onChange={(event) => void onChange(event.target.value as DecisionOutcomeValue)}
        disabled={isSubmitting}
        aria-label="結果"
      >
        <option value="" disabled>
          結果を選ぶ
        </option>
        {OUTCOME_OPTIONS.map((outcome) => (
          <option key={outcome} value={outcome}>
            {OUTCOME_LABELS[outcome]}
          </option>
        ))}
      </select>
      {error ? <p className={styles.error} role="alert">{error}</p> : null}
    </div>
  );
}
