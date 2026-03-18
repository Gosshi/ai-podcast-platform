"use client";

import { useState } from "react";
import TrackedLink from "@/app/components/TrackedLink";
import { formatFrameTypeLabel } from "@/app/lib/uiText";
import {
  describeDecisionCalculatorThresholds,
  evaluateDecisionCalculator,
  resolveDecisionCalculatorAvailability,
  type DecisionCalculatorFieldId,
  type DecisionCalculatorInputs,
  type DecisionCalculatorLocale,
  type SupportedDecisionFrame
} from "@/app/lib/decisionCalculator";
import { track } from "@/src/lib/analytics";
import type { JudgmentCard } from "@/src/lib/judgmentCards";
import styles from "./decision-calculator.module.css";

type DecisionCalculatorProps = {
  card: Pick<
    JudgmentCard,
    "id" | "episode_id" | "genre" | "frame_type" | "judgment_type" | "threshold_json" | "topic_title"
  >;
  isPaid: boolean;
  locale?: DecisionCalculatorLocale;
  analyticsPage?: string;
  analyticsSource?: string;
};

type FieldDefinition = {
  id: DecisionCalculatorFieldId;
  label: string;
  unit: string;
  step: string;
  min: string;
  placeholder: string;
};

const copy = {
  ja: {
    title: "再判定",
    subtitle: "自分の時間や費用で入れ直して、もう一度評価できます。",
    expand: "開く",
    collapse: "閉じる",
    upgradeTitle: "有料会員で再判定",
    upgradeCopy: "このトピックカードを自分の数字で再評価できます。",
    upgradeCta: "有料会員で再判定",
    submit: "再判定する",
    thresholdLabel: "判定ルール",
    resultLabel: "再判定結果",
    reasonLabel: "理由",
    metricLabel: "計算結果",
    emptyState: "数字を入れると、採用 / 見送り を即時に再判定します。"
  },
  en: {
    title: "Re-run with Your Numbers",
    subtitle: "Use the AI decision frame with your own inputs.",
    expand: "Open",
    collapse: "Close",
    upgradeTitle: "Re-run with membership",
    upgradeCopy: "Unlock the calculator for this judgment card.",
    upgradeCta: "Upgrade to recalculate",
    submit: "Run calculation",
    thresholdLabel: "Decision rule",
    resultLabel: "Result",
    reasonLabel: "Reason",
    metricLabel: "Metric",
    emptyState: "Enter your numbers to instantly re-score this card."
  }
} as const;

const getFields = (frame: SupportedDecisionFrame, locale: DecisionCalculatorLocale): FieldDefinition[] => {
  if (frame === "Frame A") {
    return [
      {
        id: "price",
        label: locale === "ja" ? "価格" : "Price",
        unit: locale === "ja" ? "円" : "JPY",
        step: "1",
        min: "0",
        placeholder: locale === "ja" ? "3600" : "3600"
      },
      {
        id: "play_time",
        label: locale === "ja" ? "プレイ時間" : "Play Time",
        unit: locale === "ja" ? "時間" : "hours",
        step: "0.1",
        min: "0",
        placeholder: locale === "ja" ? "12" : "12"
      }
    ];
  }

  if (frame === "Frame B") {
    return [
      {
        id: "monthly_cost",
        label: locale === "ja" ? "月額" : "Monthly Cost",
        unit: locale === "ja" ? "円" : "JPY",
        step: "1",
        min: "0",
        placeholder: locale === "ja" ? "1140" : "1140"
      },
      {
        id: "watch_time",
        label: locale === "ja" ? "視聴時間" : "Watch Time",
        unit: locale === "ja" ? "時間" : "hours",
        step: "0.1",
        min: "0",
        placeholder: locale === "ja" ? "2" : "2"
      }
    ];
  }

  return [
    {
      id: "ad_time",
      label: locale === "ja" ? "広告時間" : "Ad Time",
      unit: locale === "ja" ? "分" : "minutes",
      step: "1",
      min: "0",
      placeholder: locale === "ja" ? "240" : "240"
    },
    {
      id: "watch_time",
      label: locale === "ja" ? "視聴時間" : "Watch Time",
      unit: locale === "ja" ? "分" : "minutes",
      step: "1",
      min: "0",
      placeholder: locale === "ja" ? "1200" : "1200"
    }
  ];
};

const parseInputs = (values: Partial<Record<DecisionCalculatorFieldId, string>>): DecisionCalculatorInputs => {
  return Object.fromEntries(
    Object.entries(values)
      .map(([key, value]) => {
        const normalized = value?.replace(/,/g, "").trim() ?? "";
        if (!normalized) return [key, undefined];

        const parsed = Number(normalized);
        return [key, Number.isFinite(parsed) ? parsed : undefined];
      })
      .filter((entry): entry is [DecisionCalculatorFieldId, number] => typeof entry[1] === "number")
  );
};

export default function DecisionCalculator({
  card,
  isPaid,
  locale = "ja",
  analyticsPage,
  analyticsSource = "judgment_card_calculator"
}: DecisionCalculatorProps) {
  const availability = resolveDecisionCalculatorAvailability({
    frameType: card.frame_type,
    isPaid
  });
  const text = copy[locale];
  const [isOpen, setIsOpen] = useState(false);
  const [values, setValues] = useState<Partial<Record<DecisionCalculatorFieldId, string>>>({});

  if (!availability.frame) {
    return null;
  }

  const thresholdInfo = describeDecisionCalculatorThresholds({
    card,
    locale
  });
  const fields = getFields(availability.frame, locale);
  const evaluation = availability.isVisible
    ? evaluateDecisionCalculator({
        card,
        inputs: parseInputs(values),
        locale
      })
    : null;

  if (!availability.isVisible) {
    return (
      <section className={styles.panel}>
        <div className={styles.header}>
          <div>
            <p className={styles.eyebrow}>{formatFrameTypeLabel(availability.frame, availability.frame)}</p>
            <h5>{text.upgradeTitle}</h5>
          </div>
          <TrackedLink
            href="/account"
            className={styles.upgradeLink}
            eventName="judgment_card_locked_cta_click"
            eventProperties={{
              page: analyticsPage,
              source: analyticsSource,
              episode_id: card.episode_id,
              judgment_card_id: card.id,
              genre: card.genre ?? undefined,
              frame_type: card.frame_type ?? undefined,
              judgment_type: card.judgment_type
            }}
          >
            {text.upgradeCta}
          </TrackedLink>
        </div>
        <p className={styles.copy}>{text.upgradeCopy}</p>
      </section>
    );
  }

  const handleToggle = () => {
    const nextIsOpen = !isOpen;
    setIsOpen(nextIsOpen);

    if (nextIsOpen) {
      const properties = {
        page: analyticsPage,
        source: analyticsSource,
        episode_id: card.episode_id,
        judgment_card_id: card.id,
        genre: card.genre ?? undefined,
        frame_type: card.frame_type ?? undefined,
        judgment_type: card.judgment_type
      };

      track("judgment_card_expand", properties);
      track("decision_calculator_open", properties);
    }
  };

  const handleSubmit = () => {
    if (!evaluation) {
      return;
    }

    const properties = {
      page: analyticsPage,
      source: analyticsSource,
      episode_id: card.episode_id,
      judgment_card_id: card.id,
      genre: card.genre ?? undefined,
      frame_type: card.frame_type ?? undefined,
      judgment_type: card.judgment_type,
      calculator_metric: evaluation.metricDisplay,
      calculator_result: evaluation.judgmentType
    };

    track("decision_calculator_submit", properties);
    track("decision_calculator_result_view", properties);
  };

  return (
    <section className={styles.panel}>
      <div className={styles.header}>
        <div>
          <p className={styles.eyebrow}>{formatFrameTypeLabel(availability.frame, availability.frame)}</p>
          <h5>{text.title}</h5>
        </div>
        <button type="button" className={styles.toggleButton} onClick={handleToggle}>
          {isOpen ? text.collapse : text.expand}
        </button>
      </div>

      <p className={styles.copy}>{text.subtitle}</p>

      {isOpen ? (
        <div className={styles.body}>
          <div className={styles.fieldGrid}>
            {fields.map((field) => (
              <label key={field.id} className={styles.field}>
                <span>{field.label}</span>
                <div className={styles.inputWrap}>
                  <input
                    type="number"
                    inputMode="decimal"
                    min={field.min}
                    step={field.step}
                    value={values[field.id] ?? ""}
                    onChange={(event) =>
                      setValues((current) => ({
                        ...current,
                        [field.id]: event.target.value
                      }))
                    }
                    placeholder={field.placeholder}
                  />
                  <small>{field.unit}</small>
                </div>
              </label>
            ))}
          </div>

          {thresholdInfo ? (
            <div className={styles.note}>
              <strong>{text.thresholdLabel}</strong>
              <p>{thresholdInfo.summary}</p>
            </div>
          ) : null}

          <button type="button" className={styles.toggleButton} onClick={handleSubmit} disabled={!evaluation}>
            {text.submit}
          </button>

          {evaluation ? (
            <div className={styles.resultCard}>
              <div className={styles.resultHeader}>
                <span className={`${styles.resultBadge} ${styles[`result_${evaluation.judgmentType}`]}`.trim()}>
                  {evaluation.judgmentLabel}
                </span>
                <span className={styles.metricValue}>
                  {text.metricLabel}: {evaluation.metricDisplay}
                </span>
              </div>
              <p className={styles.resultReason}>
                <strong>{text.reasonLabel}</strong>
                <span>{evaluation.reason}</span>
              </p>
            </div>
          ) : (
            <p className={styles.emptyState}>{text.emptyState}</p>
          )}
        </div>
      ) : null}
    </section>
  );
}
