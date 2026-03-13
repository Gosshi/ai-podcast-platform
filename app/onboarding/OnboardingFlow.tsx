"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ACTIVE_SUBSCRIPTION_LABELS,
  ACTIVE_SUBSCRIPTION_OPTIONS,
  DAILY_AVAILABLE_TIME_LABELS,
  DAILY_AVAILABLE_TIME_OPTIONS,
  DECISION_PRIORITY_LABELS,
  DECISION_PRIORITY_OPTIONS,
  INTEREST_TOPIC_LABELS,
  INTEREST_TOPIC_OPTIONS,
  type ActiveSubscription,
  type DailyAvailableTime,
  type DecisionPriority,
  type InterestTopic,
  type UserPreferences
} from "@/src/lib/userPreferences";
import styles from "./page.module.css";

type OnboardingFlowProps = {
  initialPreferences: UserPreferences | null;
  nextPath: string;
  isFirstRun: boolean;
};

const STEP_COUNT = 3;

const STEP_TITLES = [
  {
    eyebrow: "Step 1",
    title: "興味ジャンルを選ぶ",
    description: "Decision Engine が cold start で外さないための基本シグナルです。複数選択できます。"
  },
  {
    eyebrow: "Step 2",
    title: "使っているサービスを教える",
    description: "今すぐ使える候補か、加入前提の候補かを切り分けるために使います。"
  },
  {
    eyebrow: "Step 3",
    title: "判断スタイルを決める",
    description: "何を優先するかと、1日に使える時間を取得して profile を初期化します。"
  }
] as const;

const ERROR_MESSAGES: Record<string, string> = {
  interest_topics_required: "興味ジャンルを1つ以上選んでください。",
  active_subscriptions_required: "使っているサービスを1つ以上選んでください。",
  decision_priority_required: "判断で優先したいことを選んでください。",
  daily_available_time_required: "1日に使える時間を選んでください。",
  unauthorized: "セッションが切れています。ログインし直してください。"
};

const toggleSelection = <T extends string>(current: T[], value: T, exclusiveValue?: T): T[] => {
  const next = current.includes(value) ? current.filter((entry) => entry !== value) : [...current, value];
  if (!exclusiveValue) {
    return next;
  }

  if (value === exclusiveValue) {
    return next.includes(exclusiveValue) ? [exclusiveValue] : [];
  }

  return next.filter((entry) => entry !== exclusiveValue);
};

const canProceedFromStep = (step: number, state: {
  interestTopics: InterestTopic[];
  activeSubscriptions: ActiveSubscription[];
  decisionPriority: DecisionPriority | null;
  dailyAvailableTime: DailyAvailableTime | null;
}): boolean => {
  if (step === 0) {
    return state.interestTopics.length > 0;
  }

  if (step === 1) {
    return state.activeSubscriptions.length > 0;
  }

  return Boolean(state.decisionPriority && state.dailyAvailableTime);
};

export default function OnboardingFlow({ initialPreferences, nextPath, isFirstRun }: OnboardingFlowProps) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [interestTopics, setInterestTopics] = useState<InterestTopic[]>(initialPreferences?.interestTopics ?? []);
  const [activeSubscriptions, setActiveSubscriptions] = useState<ActiveSubscription[]>(
    initialPreferences?.activeSubscriptions ?? []
  );
  const [decisionPriority, setDecisionPriority] = useState<DecisionPriority | null>(
    initialPreferences?.decisionPriority ?? null
  );
  const [dailyAvailableTime, setDailyAvailableTime] = useState<DailyAvailableTime | null>(
    initialPreferences?.dailyAvailableTime ?? null
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const currentStep = STEP_TITLES[step];
  const canContinue = useMemo(
    () =>
      canProceedFromStep(step, {
        interestTopics,
        activeSubscriptions,
        decisionPriority,
        dailyAvailableTime
      }),
    [activeSubscriptions, dailyAvailableTime, decisionPriority, interestTopics, step]
  );

  const handleNext = () => {
    if (!canContinue) {
      setError("必要な項目を選択してください。");
      return;
    }

    setError(null);
    setStep((current) => Math.min(current + 1, STEP_COUNT - 1));
  };

  const handleBack = () => {
    setError(null);
    setStep((current) => Math.max(current - 1, 0));
  };

  const handleSubmit = () => {
    if (!decisionPriority || !dailyAvailableTime) {
      setError(ERROR_MESSAGES.decision_priority_required);
      return;
    }

    setError(null);
    startTransition(() => {
      void fetch("/api/user-preferences", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          interestTopics,
          activeSubscriptions,
          decisionPriority,
          dailyAvailableTime
        })
      })
        .then(async (response) => {
          const payload = (await response.json().catch(() => ({}))) as {
            ok?: boolean;
            error?: string;
          };

          if (!response.ok || payload.ok !== true) {
            throw new Error(ERROR_MESSAGES[payload.error ?? ""] ?? "設定の保存に失敗しました。");
          }

          router.replace(nextPath);
          router.refresh();
        })
        .catch((requestError) => {
          setError(requestError instanceof Error ? requestError.message : "設定の保存に失敗しました。");
        });
    });
  };

  return (
    <section className={styles.panel}>
      <div className={styles.progressRow}>
        {STEP_TITLES.map((item, index) => (
          <div key={item.title} className={styles.progressItem}>
            <span
              className={`${styles.progressDot} ${index <= step ? styles.progressDotActive : ""}`.trim()}
              aria-hidden="true"
            />
            <span className={styles.progressLabel}>{item.eyebrow}</span>
          </div>
        ))}
      </div>

      <div className={styles.stepHeader}>
        <p className={styles.stepEyebrow}>{currentStep.eyebrow}</p>
        <h2>{currentStep.title}</h2>
        <p>{currentStep.description}</p>
        {!isFirstRun && initialPreferences ? (
          <span className={styles.savedBadge}>保存済みの設定を更新できます</span>
        ) : null}
      </div>

      {step === 0 ? (
        <div className={styles.optionGrid}>
          {INTEREST_TOPIC_OPTIONS.map((topic) => (
            <button
              key={topic}
              type="button"
              className={`${styles.optionCard} ${interestTopics.includes(topic) ? styles.optionCardActive : ""}`.trim()}
              onClick={() => {
                setError(null);
                setInterestTopics(toggleSelection(interestTopics, topic));
              }}
            >
              <strong>{INTEREST_TOPIC_LABELS[topic]}</strong>
              <span>{topic}</span>
            </button>
          ))}
        </div>
      ) : null}

      {step === 1 ? (
        <div className={styles.optionGrid}>
          {ACTIVE_SUBSCRIPTION_OPTIONS.map((subscription) => (
            <button
              key={subscription}
              type="button"
              className={`${styles.optionCard} ${activeSubscriptions.includes(subscription) ? styles.optionCardActive : ""}`.trim()}
              onClick={() => {
                setError(null);
                setActiveSubscriptions(toggleSelection(activeSubscriptions, subscription, "none"));
              }}
            >
              <strong>{ACTIVE_SUBSCRIPTION_LABELS[subscription]}</strong>
              <span>{subscription === "none" ? "サブスクなし" : "active subscription"}</span>
            </button>
          ))}
        </div>
      ) : null}

      {step === 2 ? (
        <div className={styles.formGrid}>
          <div className={styles.group}>
            <p className={styles.groupLabel}>判断で何を優先しますか</p>
            <div className={styles.optionGrid}>
              {DECISION_PRIORITY_OPTIONS.map((priority) => (
                <button
                  key={priority}
                  type="button"
                  className={`${styles.optionCard} ${decisionPriority === priority ? styles.optionCardActive : ""}`.trim()}
                  onClick={() => {
                    setError(null);
                    setDecisionPriority(priority);
                  }}
                >
                  <strong>{DECISION_PRIORITY_LABELS[priority]}</strong>
                  <span>{priority}</span>
                </button>
              ))}
            </div>
          </div>

          <div className={styles.group}>
            <p className={styles.groupLabel}>1日にどれくらい時間を使えますか</p>
            <div className={styles.optionGrid}>
              {DAILY_AVAILABLE_TIME_OPTIONS.map((time) => (
                <button
                  key={time}
                  type="button"
                  className={`${styles.optionCard} ${dailyAvailableTime === time ? styles.optionCardActive : ""}`.trim()}
                  onClick={() => {
                    setError(null);
                    setDailyAvailableTime(time);
                  }}
                >
                  <strong>{DAILY_AVAILABLE_TIME_LABELS[time]}</strong>
                  <span>{time}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {error ? <p className={styles.errorMessage}>{error}</p> : null}

      <div className={styles.actionRow}>
        <button type="button" className={styles.secondaryButton} onClick={handleBack} disabled={step === 0 || isPending}>
          戻る
        </button>
        {step < STEP_COUNT - 1 ? (
          <button type="button" className={styles.primaryButton} onClick={handleNext} disabled={!canContinue || isPending}>
            次へ
          </button>
        ) : (
          <button type="button" className={styles.primaryButton} onClick={handleSubmit} disabled={!canContinue || isPending}>
            {isPending ? "保存中..." : isFirstRun ? "Onboarding を完了" : "設定を更新"}
          </button>
        )}
      </div>
    </section>
  );
}
