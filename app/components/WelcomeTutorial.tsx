"use client";

import { useState } from "react";
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

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

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
    <div className={styles.overlay} role="dialog" aria-label="使い方ガイド">
      <div className={styles.card}>
        <button type="button" className={styles.skipButton} onClick={handleSkip}>
          スキップ
        </button>

        <div className={styles.icon} aria-hidden="true">{current.icon}</div>
        <h2 className={styles.title}>{current.title}</h2>
        <p className={styles.body}>{current.body}</p>

        <div className={styles.progress}>
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={`${styles.dot} ${i === step ? styles.dotActive : i < step ? styles.dotDone : ""}`.trim()}
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
