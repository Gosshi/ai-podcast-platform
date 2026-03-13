import type { JudgmentThresholdJson } from "@/src/lib/judgmentCards";

type GateableJudgmentFields = {
  action_text: string | null;
  deadline_at: string | null;
  threshold_json: JudgmentThresholdJson;
  watch_points: string[];
};

const THRESHOLD_LABELS = {
  price: "価格基準",
  play_time: "プレイ時間",
  watch_time: "視聴時間",
  monthly_cost: "月額",
  ad_time: "広告時間",
  time_limit: "時間基準",
  unit_cost: "単価基準",
  ratio: "比率基準"
} as const;

export const lockJudgmentDetails = <T extends GateableJudgmentFields>(card: T): T => {
  return {
    ...card,
    action_text: null,
    deadline_at: null,
    threshold_json: {},
    watch_points: []
  };
};

export const formatThresholdHighlights = (thresholdJson: JudgmentThresholdJson): string[] => {
  const lines = (Object.entries(THRESHOLD_LABELS) as Array<
    [keyof typeof THRESHOLD_LABELS, (typeof THRESHOLD_LABELS)[keyof typeof THRESHOLD_LABELS]]
  >).flatMap(([key, label]) =>
    (thresholdJson[key] ?? []).map((entry) => `${entry.label ?? label}: ${entry.raw}`)
  );

  return [...lines, ...(thresholdJson.other ?? [])].slice(0, 4);
};
