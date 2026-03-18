"use client";

import { useEffect, useRef, useState } from "react";
import { track } from "@/src/lib/analytics";
import styles from "./welcome-tutorial.module.css";

const STEPS = [
  {
    icon: "🎧",
    title: "毎朝、エピソードが届きます",
    body: "AIが最新トレンドから5〜10分のエピソードを毎日生成。通勤や家事のあいだに聴くだけでOKです。"
  },
  {
    icon: "🃏",
    title: "トピックカードで要点を確認",
    body: "エピソードの重要ポイントがカードにまとまっています。気になったものは「採用」、そうでなければ「見送り」。"
  },
  {
    icon: "📊",
    title: "履歴で振り返り、次に活かす",
    body: "採用したアクションの結果を記録すると、満足率や傾向がわかります。次のアクション選びに役立ちます。"
  }
] as const;

type WelcomeTutorialProps = {
  page: string;
  onClose: () => void;
};

export default function WelcomeTutorial({ page, onClose }: WelcomeTutorialProps) {
  const [step, setStep] = useState(0);
  const dialogRef = useRef<HTMLDivElement>(null);

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  // Focus trap and Escape key
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    // Auto-focus the dialog on mount
    dialog.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }

      if (e.key === "Tab") {
        const focusable = dialog.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const handleNext = () => {
    track("tutorial_step", {
      page,
      source: "welcome_tutorial",
      step_number: step + 1,
      step_title: current.title
    });

    if (isLast) {
      track("tutorial_complete", {
        page,
        source: "welcome_tutorial",
        total_steps: STEPS.length
      });
      onClose();
      return;
    }

    setStep((s) => s + 1);
  };

  const handleSkip = () => {
    track("tutorial_skip", {
      page,
      source: "welcome_tutorial",
      skipped_at_step: step + 1,
      total_steps: STEPS.length
    });
    onClose();
  };

  return (
    <div className={styles.overlay} role="dialog" aria-label="使い方ガイド" aria-modal="true">
      <div className={styles.card} ref={dialogRef} tabIndex={-1}>
        <button type="button" className={styles.skipButton} onClick={handleSkip}>
          スキップ
        </button>

        <div className={styles.icon} aria-hidden="true">{current.icon}</div>
        <h2 className={styles.title}>{current.title}</h2>
        <p className={styles.body}>{current.body}</p>

        <div className={styles.progress} role="progressbar" aria-valuenow={step + 1} aria-valuemin={1} aria-valuemax={STEPS.length} aria-label={`ステップ ${step + 1} / ${STEPS.length}`}>
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={`${styles.dot} ${i === step ? styles.dotActive : i < step ? styles.dotDone : ""}`.trim()}
              aria-hidden="true"
            />
          ))}
        </div>

        <button type="button" className={styles.nextButton} onClick={handleNext}>
          {isLast ? "はじめる" : "次へ"}
        </button>
      </div>
    </div>
  );
}
