"use client";

import { useState } from "react";
import { OUTCOME_LABELS, type DecisionOutcome } from "@/app/lib/decisionHistory";
import styles from "./decision-history-controls.module.css";

type DecisionOutcomeSelectProps = {
  decisionId: string;
  initialOutcome: DecisionOutcome;
};

type UpdateDecisionResponse =
  | {
      ok: true;
      decision: {
        id: string;
        outcome: DecisionOutcome;
        updated_at: string;
      };
    }
  | {
      ok: false;
      error: string;
    };

const OUTCOME_OPTIONS: DecisionOutcome[] = ["success", "neutral", "regret"];

export default function DecisionOutcomeSelect({
  decisionId,
  initialOutcome
}: DecisionOutcomeSelectProps) {
  const [value, setValue] = useState<DecisionOutcome>(initialOutcome);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onChange = async (nextValue: DecisionOutcome) => {
    const previousValue = value;
    setValue(nextValue);
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/decision-history/${decisionId}`, {
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
      }
    } catch {
      setValue(previousValue);
      setError("結果の更新に失敗しました。");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={styles.actionRow}>
      <select
        className={styles.select}
        value={value}
        onChange={(event) => void onChange(event.target.value as DecisionOutcome)}
        disabled={isSubmitting}
        aria-label="判断結果"
      >
        {OUTCOME_OPTIONS.map((outcome) => (
          <option key={outcome} value={outcome}>
            {OUTCOME_LABELS[outcome]}
          </option>
        ))}
      </select>
      {error ? <p className={styles.error}>{error}</p> : null}
    </div>
  );
}
