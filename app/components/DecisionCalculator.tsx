"use client";

import Link from "next/link";
import { useState } from "react";
import {
  describeDecisionCalculatorThresholds,
  evaluateDecisionCalculator,
  resolveDecisionCalculatorAvailability,
  type DecisionCalculatorFieldId,
  type DecisionCalculatorInputs,
  type DecisionCalculatorLocale,
  type SupportedDecisionFrame
} from "@/app/lib/decisionCalculator";
import type { JudgmentCard } from "@/src/lib/judgmentCards";
import styles from "./decision-calculator.module.css";

type DecisionCalculatorProps = {
  card: Pick<JudgmentCard, "frame_type" | "threshold_json" | "topic_title">;
  isPaid: boolean;
  locale?: DecisionCalculatorLocale;
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
    title: "あなたの数字で再判定",
    subtitle: "AIの判断フレームで、あなたのコスト感に合わせて即時計算します。",
    expand: "開く",
    collapse: "閉じる",
    upgradeTitle: "有料会員で再判定",
    upgradeCopy: "この判断カードを自分の数字で再評価できます。",
    upgradeCta: "有料会員で再判定",
    thresholdLabel: "判定ルール",
    resultLabel: "再判定結果",
    reasonLabel: "理由",
    metricLabel: "計算結果",
    emptyState: "数字を入れると、今使う / 監視 / 見送り を即時に再判定します。"
  },
  en: {
    title: "Re-run with Your Numbers",
    subtitle: "Use the AI decision frame with your own inputs.",
    expand: "Open",
    collapse: "Close",
    upgradeTitle: "Re-run with membership",
    upgradeCopy: "Unlock the calculator for this judgment card.",
    upgradeCta: "Upgrade to recalculate",
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
  locale = "ja"
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
            <p className={styles.eyebrow}>{availability.frame}</p>
            <h5>{text.upgradeTitle}</h5>
          </div>
          <Link href="/account" className={styles.upgradeLink}>
            {text.upgradeCta}
          </Link>
        </div>
        <p className={styles.copy}>{text.upgradeCopy}</p>
      </section>
    );
  }

  return (
    <section className={styles.panel}>
      <div className={styles.header}>
        <div>
          <p className={styles.eyebrow}>{availability.frame}</p>
          <h5>{text.title}</h5>
        </div>
        <button type="button" className={styles.toggleButton} onClick={() => setIsOpen((current) => !current)}>
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
