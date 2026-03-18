"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { track } from "@/src/lib/analytics";
import {
  ACTIVE_SUBSCRIPTION_LABELS,
  ACTIVE_SUBSCRIPTION_OPTIONS,
  BUDGET_SENSITIVITY_LABELS,
  BUDGET_SENSITIVITY_OPTIONS,
  DAILY_AVAILABLE_TIME_LABELS,
  DAILY_AVAILABLE_TIME_OPTIONS,
  DECISION_PRIORITY_LABELS,
  DECISION_PRIORITY_OPTIONS,
  INTEREST_TOPIC_LABELS,
  INTEREST_TOPIC_OPTIONS,
  type ActiveSubscription,
  type BudgetSensitivity,
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

const STEP_TITLES = [
  {
    id: "interest_topics",
    eyebrow: "1 / 4",
    title: "聴きたいジャンルを選ぶ",
    description: "毎日届くポッドキャストのテーマを選びます。複数選べます。"
  },
  {
    id: "active_subscriptions",
    eyebrow: "2 / 4",
    title: "使っているサービスを教える",
    description: "利用中のサービスに合わせた情報をエピソードに反映します。"
  },
  {
    id: "decision_priority",
    eyebrow: "3 / 4",
    title: "重視する観点を選ぶ",
    description: "コスト、時間、新しい発見、リスク回避のどれを重視するか教えてください。"
  },
  {
    id: "time_and_budget",
    eyebrow: "4 / 4",
    title: "聴ける時間を教える",
    description: "ポッドキャストに使える時間と予算感覚から、最適なエピソードをお届けします。"
  }
] as const;

const STEP_COUNT = STEP_TITLES.length;

const ERROR_MESSAGES: Record<string, string> = {
  interest_topics_required: "興味ジャンルを1つ以上選んでください。",
  active_subscriptions_required: "使っているサービスを1つ以上選んでください。",
  decision_priority_required: "重視したいことを選んでください。",
  daily_available_time_required: "1日に使える時間を選んでください。",
  budget_sensitivity_invalid: "予算感度の値が不正です。もう一度選び直してください。",
  unauthorized: "セッションが切れています。ログインし直してください。"
};

const INTEREST_TOPIC_HELPERS: Record<InterestTopic, string> = {
  games: "ゲームやエンタメの最新情報",
  streaming: "サブスクの比較や見直し",
  anime: "注目作品やおすすめ",
  movies: "映画やドラマの話題",
  tech: "ガジェットや新サービス",
  lifestyle: "暮らしの工夫やトレンド",
  work: "仕事術や生産性の話題",
  shopping: "買い物のヒントやレビュー"
};

const ACTIVE_SUBSCRIPTION_HELPERS: Record<ActiveSubscription, string> = {
  netflix: "Netflixを使っている",
  prime: "Prime Videoを使っている",
  disney: "Disney+を使っている",
  spotify: "Spotifyを使っている",
  youtube: "YouTubeを使っている",
  chatgpt: "ChatGPTを使っている",
  notion: "Notionを使っている",
  github: "GitHubを使っている",
  other: "その他のサービスを使っている",
  none: "今は使っていない"
};

const DECISION_PRIORITY_HELPERS: Record<DecisionPriority, string> = {
  save_money: "追加課金を抑えたい",
  save_time: "短時間で迷いを減らしたい",
  discover_new: "新しいものを試したい",
  avoid_regret: "選んで後悔する確率を下げたい"
};

const DAILY_AVAILABLE_TIME_HELPERS: Record<DailyAvailableTime, string> = {
  under_30m: "通勤中にさっと聴ける",
  "30_to_60m": "じっくり1エピソード聴ける",
  "1_to_2h": "複数エピソードを聴ける",
  over_2h: "まとまった時間がある"
};

const BUDGET_HELPERS: Record<BudgetSensitivity, string> = {
  low: "課金はあまり気にしない",
  medium: "内容次第で決めたい",
  high: "追加料金には慎重"
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
  budgetSensitivity: BudgetSensitivity | null;
}): boolean => {
  if (step === 0) {
    return state.interestTopics.length > 0;
  }

  if (step === 1) {
    return state.activeSubscriptions.length > 0;
  }

  if (step === 2) {
    return Boolean(state.decisionPriority);
  }

  return Boolean(state.dailyAvailableTime);
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
  const [budgetSensitivity, setBudgetSensitivity] = useState<BudgetSensitivity | null>(
    initialPreferences?.budgetSensitivity ?? null
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const hasTrackedStartRef = useRef(false);

  const currentStep = STEP_TITLES[step];
  const analyticsSource = isFirstRun ? "onboarding_first_run" : "onboarding_preferences_refresh";
  const canContinue = useMemo(
    () =>
      canProceedFromStep(step, {
        interestTopics,
        activeSubscriptions,
        decisionPriority,
        dailyAvailableTime,
        budgetSensitivity
      }),
    [activeSubscriptions, budgetSensitivity, dailyAvailableTime, decisionPriority, interestTopics, step]
  );

  useEffect(() => {
    if (hasTrackedStartRef.current) {
      return;
    }

    hasTrackedStartRef.current = true;
    track("onboarding_start", {
      page: "/onboarding",
      source: analyticsSource,
      is_first_run: isFirstRun,
      has_existing_preferences: Boolean(initialPreferences),
      next_path: nextPath
    });
  }, [analyticsSource, initialPreferences, isFirstRun, nextPath]);

  const trackStepCompletion = (completedStep: number) => {
    const completed = STEP_TITLES[completedStep];
    if (!completed) {
      return;
    }

    const selectedCount =
      completed.id === "interest_topics"
        ? interestTopics.length
        : completed.id === "active_subscriptions"
          ? activeSubscriptions.length
          : completed.id === "decision_priority"
            ? Number(Boolean(decisionPriority))
            : Number(Boolean(dailyAvailableTime)) + Number(Boolean(budgetSensitivity));

    track("onboarding_step_complete", {
      page: "/onboarding",
      source: analyticsSource,
      is_first_run: isFirstRun,
      step_number: completedStep + 1,
      step_key: completed.id,
      selected_count: selectedCount
    });
  };

  const handleNext = () => {
    if (!canContinue) {
      setError("必要な項目を選択してください。");
      return;
    }

    setError(null);
    trackStepCompletion(step);
    setStep((current) => Math.min(current + 1, STEP_COUNT - 1));
  };

  const handleBack = () => {
    setError(null);
    setStep((current) => Math.max(current - 1, 0));
  };

  const handleSubmit = () => {
    if (!decisionPriority) {
      setError(ERROR_MESSAGES.decision_priority_required);
      return;
    }

    if (!dailyAvailableTime) {
      setError(ERROR_MESSAGES.daily_available_time_required);
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
          dailyAvailableTime,
          budgetSensitivity
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

          trackStepCompletion(step);
          track("onboarding_complete", {
            page: "/onboarding",
            source: analyticsSource,
            is_first_run: isFirstRun,
            interest_topic_count: interestTopics.length,
            active_subscription_count: activeSubscriptions.filter((entry) => entry !== "none").length,
            decision_priority: decisionPriority,
            daily_available_time: dailyAvailableTime,
            budget_sensitivity: budgetSensitivity,
            next_path: nextPath
          });

          const redirectUrl = nextPath === "/decisions" ? "/decisions?welcome=1" : nextPath;
          router.replace(redirectUrl);
          router.refresh();
        })
        .catch((requestError) => {
          setError(requestError instanceof Error ? requestError.message : "設定の保存に失敗しました。");
        });
    });
  };

  return (
    <section className={styles.panel}>
      <div className={styles.progressRow} role="progressbar" aria-valuenow={step + 1} aria-valuemin={1} aria-valuemax={STEP_TITLES.length} aria-label={`ステップ ${step + 1} / ${STEP_TITLES.length}`}>
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
          <span className={styles.savedBadge}>保存済みの設定を見直せます</span>
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
              <span>{INTEREST_TOPIC_HELPERS[topic]}</span>
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
              <span>{ACTIVE_SUBSCRIPTION_HELPERS[subscription]}</span>
            </button>
          ))}
        </div>
      ) : null}

      {step === 2 ? (
        <div className={styles.group}>
          <p className={styles.groupLabel}>何を重視しますか</p>
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
                <span>{DECISION_PRIORITY_HELPERS[priority]}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {step === 3 ? (
        <div className={styles.formGrid}>
          <div className={styles.group}>
            <p className={styles.groupLabel}>1日にどれくらい聴けますか</p>
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
                  <span>{DAILY_AVAILABLE_TIME_HELPERS[time]}</span>
                </button>
              ))}
            </div>
          </div>

          <div className={styles.group}>
            <div className={styles.groupLabelRow}>
              <p className={styles.groupLabel}>予算感度</p>
              <span className={styles.optionalTag}>任意 / あとで変更可</span>
            </div>
            <div className={styles.optionGrid}>
              {BUDGET_SENSITIVITY_OPTIONS.map((budgetValue) => (
                <button
                  key={budgetValue}
                  type="button"
                  className={`${styles.optionCard} ${budgetSensitivity === budgetValue ? styles.optionCardActive : ""}`.trim()}
                  onClick={() => {
                    setError(null);
                    setBudgetSensitivity((current) => (current === budgetValue ? null : budgetValue));
                  }}
                >
                  <strong>{BUDGET_SENSITIVITY_LABELS[budgetValue]}</strong>
                  <span>{BUDGET_HELPERS[budgetValue]}</span>
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
            {isPending ? "保存中..." : isFirstRun ? "設定を完了する" : "設定を更新"}
          </button>
        )}
      </div>
    </section>
  );
}
