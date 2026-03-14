import type { JudgmentCard, JudgmentThresholdEntry, JudgmentThresholdJson, JudgmentType } from "@/src/lib/judgmentCards";

export type DecisionCalculatorLocale = "ja" | "en";

export type SupportedDecisionFrame = "Frame A" | "Frame B" | "Frame D";

export type DecisionCalculatorFieldId = "price" | "play_time" | "monthly_cost" | "watch_time" | "ad_time";

export type DecisionCalculatorInputs = Partial<Record<DecisionCalculatorFieldId, number>>;

export type DecisionCalculatorAvailability = {
  frame: SupportedDecisionFrame | null;
  isSupported: boolean;
  isVisible: boolean;
  showUpgradeCta: boolean;
};

export type DecisionCalculatorEvaluation = {
  frame: SupportedDecisionFrame;
  judgmentType: JudgmentType;
  judgmentLabel: string;
  metricLabel: string;
  metricValue: number;
  metricDisplay: string;
  thresholdSummary: string;
  reason: string;
};

export type DecisionCalculatorThresholdSummary = {
  frame: SupportedDecisionFrame;
  metricLabel: string;
  summary: string;
};

type UnitCostThresholds = {
  useNowMax: number;
  skipAbove: number;
};

const FRAME_TYPES = new Set<SupportedDecisionFrame>(["Frame A", "Frame B", "Frame D"]);

const toFiniteNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.replace(/,/g, "").trim();
    if (!normalized) return null;

    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

const normalizeThresholdEntries = (value: unknown): JudgmentThresholdEntry[] => {
  return Array.isArray(value)
    ? value.filter(
        (entry): entry is JudgmentThresholdEntry =>
          typeof entry === "object" && entry !== null && toFiniteNumber((entry as JudgmentThresholdEntry).value) !== null
      )
    : [];
};

const readThresholdNumbers = (entries: JudgmentThresholdEntry[] | undefined): number[] => {
  return Array.from(
    new Set(
      (entries ?? [])
        .map((entry) => toFiniteNumber(entry.value))
        .filter((value): value is number => value !== null && value >= 0)
    )
  ).sort((left, right) => left - right);
};

const readUnitCostThresholds = (
  thresholdJson: JudgmentThresholdJson,
  defaults: UnitCostThresholds
): UnitCostThresholds => {
  const candidates = readThresholdNumbers(normalizeThresholdEntries(thresholdJson.unit_cost));
  if (candidates.length >= 2) {
    return {
      useNowMax: candidates[0],
      skipAbove: candidates[candidates.length - 1]
    };
  }

  return defaults;
};

const readRatioThreshold = (thresholdJson: JudgmentThresholdJson, defaultLimit: number): number => {
  const candidates = readThresholdNumbers(normalizeThresholdEntries(thresholdJson.ratio));
  return candidates[0] ?? defaultLimit;
};

const formatDecimal = (value: number, digits: number, locale: DecisionCalculatorLocale): string => {
  return new Intl.NumberFormat(locale === "ja" ? "ja-JP" : "en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits
  }).format(value);
};

const formatCurrency = (value: number, locale: DecisionCalculatorLocale): string => {
  return new Intl.NumberFormat(locale === "ja" ? "ja-JP" : "en-US", {
    style: "currency",
    currency: "JPY",
    maximumFractionDigits: 0
  }).format(value);
};

const resolveJudgmentLabel = (judgmentType: JudgmentType, locale: DecisionCalculatorLocale): string => {
  if (locale === "en") {
    if (judgmentType === "use_now") return "Use Now";
    if (judgmentType === "watch") return "Watch";
    return "Skip";
  }

  if (judgmentType === "use_now") return "採用";
  if (judgmentType === "watch") return "後で考える";
  return "見送る";
};

const evaluateUnitCost = (params: {
  frame: "Frame A" | "Frame B";
  cost: number;
  hours: number;
  thresholdJson: JudgmentThresholdJson;
  locale: DecisionCalculatorLocale;
}): DecisionCalculatorEvaluation | null => {
  if (params.cost <= 0 || params.hours <= 0) return null;

  const metricValue = params.cost / params.hours;
  const thresholds =
    params.frame === "Frame A"
      ? readUnitCostThresholds(params.thresholdJson, { useNowMax: 500, skipAbove: 800 })
      : readUnitCostThresholds(params.thresholdJson, { useNowMax: 600, skipAbove: 1000 });

  const judgmentType: JudgmentType =
    metricValue <= thresholds.useNowMax ? "use_now" : metricValue > thresholds.skipAbove ? "skip" : "watch";
  const metricDisplay =
    params.locale === "ja"
      ? `${formatCurrency(metricValue, params.locale)}/時間`
      : `${formatCurrency(metricValue, params.locale)}/hour`;
  const thresholdSummary =
    params.locale === "ja"
      ? `${formatCurrency(thresholds.useNowMax, params.locale)}/時間以下で採用、${formatCurrency(thresholds.skipAbove, params.locale)}/時間超で見送る`
      : `Use now at or below ${formatCurrency(thresholds.useNowMax, params.locale)}/hour, skip above ${formatCurrency(thresholds.skipAbove, params.locale)}/hour`;

  let reason = "";
  if (params.locale === "ja") {
    reason =
      judgmentType === "use_now"
        ? `1時間単価は ${metricDisplay} で、許容ラインの ${formatCurrency(thresholds.useNowMax, params.locale)}/時間 以下です。`
        : judgmentType === "skip"
          ? `1時間単価は ${metricDisplay} で、見送るラインの ${formatCurrency(thresholds.skipAbove, params.locale)}/時間 を超えています。`
          : `1時間単価は ${metricDisplay} で、採用基準と見送る基準の間です。`;
  } else {
    reason =
      judgmentType === "use_now"
        ? `Your cost per hour is ${metricDisplay}, which is within the use-now threshold.`
        : judgmentType === "skip"
          ? `Your cost per hour is ${metricDisplay}, which is above the skip threshold.`
          : `Your cost per hour is ${metricDisplay}, which sits between the use-now and skip thresholds.`;
  }

  return {
    frame: params.frame,
    judgmentType,
    judgmentLabel: resolveJudgmentLabel(judgmentType, params.locale),
    metricLabel: params.locale === "ja" ? "1時間単価" : "Cost per hour",
    metricValue,
    metricDisplay,
    thresholdSummary,
    reason
  };
};

const evaluateAdRatio = (params: {
  adTime: number;
  watchTime: number;
  thresholdJson: JudgmentThresholdJson;
  locale: DecisionCalculatorLocale;
}): DecisionCalculatorEvaluation | null => {
  if (params.adTime < 0 || params.watchTime <= 0) return null;

  const metricValue = (params.adTime / params.watchTime) * 100;
  const threshold = readRatioThreshold(params.thresholdJson, 15);
  const judgmentType: JudgmentType = metricValue > threshold ? "skip" : "use_now";
  const metricDisplay = `${formatDecimal(metricValue, 1, params.locale)}%`;
  const thresholdSummary =
    params.locale === "ja"
      ? `${formatDecimal(threshold, 1, params.locale)}%以下で継続、超えたら見送る`
      : `Keep using at or below ${formatDecimal(threshold, 1, params.locale)}%, skip above it`;

  const reason =
    params.locale === "ja"
      ? judgmentType === "use_now"
        ? `広告比率は ${metricDisplay} で、許容ラインの ${formatDecimal(threshold, 1, params.locale)}% 以下です。`
        : `広告比率は ${metricDisplay} で、許容ラインの ${formatDecimal(threshold, 1, params.locale)}% を超えています。`
      : judgmentType === "use_now"
        ? `Your ad ratio is ${metricDisplay}, which stays within the acceptable range.`
        : `Your ad ratio is ${metricDisplay}, which is above the acceptable range.`;

  return {
    frame: "Frame D",
    judgmentType,
    judgmentLabel: resolveJudgmentLabel(judgmentType, params.locale),
    metricLabel: params.locale === "ja" ? "広告比率" : "Ad ratio",
    metricValue,
    metricDisplay,
    thresholdSummary,
    reason
  };
};

export const normalizeDecisionFrame = (frameType: string | null | undefined): SupportedDecisionFrame | null => {
  if (!frameType) return null;
  return FRAME_TYPES.has(frameType as SupportedDecisionFrame) ? (frameType as SupportedDecisionFrame) : null;
};

export const resolveDecisionCalculatorAvailability = (params: {
  frameType: string | null | undefined;
  isPaid: boolean;
}): DecisionCalculatorAvailability => {
  const frame = normalizeDecisionFrame(params.frameType);
  const isSupported = frame !== null;

  return {
    frame,
    isSupported,
    isVisible: Boolean(frame && params.isPaid),
    showUpgradeCta: Boolean(frame && !params.isPaid)
  };
};

export const evaluateDecisionCalculator = (params: {
  card: Pick<JudgmentCard, "frame_type" | "threshold_json">;
  inputs: DecisionCalculatorInputs;
  locale?: DecisionCalculatorLocale;
}): DecisionCalculatorEvaluation | null => {
  const frame = normalizeDecisionFrame(params.card.frame_type);
  if (!frame) return null;

  const locale = params.locale ?? "ja";
  const thresholdJson = params.card.threshold_json ?? {};

  if (frame === "Frame A") {
    return evaluateUnitCost({
      frame,
      cost: params.inputs.price ?? 0,
      hours: params.inputs.play_time ?? 0,
      thresholdJson,
      locale
    });
  }

  if (frame === "Frame B") {
    return evaluateUnitCost({
      frame,
      cost: params.inputs.monthly_cost ?? 0,
      hours: params.inputs.watch_time ?? 0,
      thresholdJson,
      locale
    });
  }

  return evaluateAdRatio({
    adTime: params.inputs.ad_time ?? 0,
    watchTime: params.inputs.watch_time ?? 0,
    thresholdJson,
    locale
  });
};

export const describeDecisionCalculatorThresholds = (params: {
  card: Pick<JudgmentCard, "frame_type" | "threshold_json">;
  locale?: DecisionCalculatorLocale;
}): DecisionCalculatorThresholdSummary | null => {
  const frame = normalizeDecisionFrame(params.card.frame_type);
  if (!frame) return null;

  const locale = params.locale ?? "ja";
  const thresholdJson = params.card.threshold_json ?? {};

  if (frame === "Frame A") {
    const thresholds = readUnitCostThresholds(thresholdJson, { useNowMax: 500, skipAbove: 800 });
    return {
      frame,
      metricLabel: locale === "ja" ? "1時間単価" : "Cost per hour",
      summary:
        locale === "ja"
          ? `${formatCurrency(thresholds.useNowMax, locale)}/時間以下なら採用、${formatCurrency(thresholds.skipAbove, locale)}/時間超なら見送る`
          : `Use now at or below ${formatCurrency(thresholds.useNowMax, locale)}/hour, skip above ${formatCurrency(thresholds.skipAbove, locale)}/hour`
    };
  }

  if (frame === "Frame B") {
    const thresholds = readUnitCostThresholds(thresholdJson, { useNowMax: 600, skipAbove: 1000 });
    return {
      frame,
      metricLabel: locale === "ja" ? "時間あたり月額" : "Monthly cost per hour",
      summary:
        locale === "ja"
          ? `${formatCurrency(thresholds.useNowMax, locale)}/時間以下なら採用、${formatCurrency(thresholds.skipAbove, locale)}/時間超なら見送る`
          : `Use now at or below ${formatCurrency(thresholds.useNowMax, locale)}/hour, skip above ${formatCurrency(thresholds.skipAbove, locale)}/hour`
    };
  }

  const threshold = readRatioThreshold(thresholdJson, 15);
  return {
    frame,
    metricLabel: locale === "ja" ? "広告比率" : "Ad ratio",
    summary:
      locale === "ja"
        ? `${formatDecimal(threshold, 1, locale)}%以下なら継続、超えたら見送る`
        : `Keep using at or below ${formatDecimal(threshold, 1, locale)}%, skip above it`
  };
};
