import type { JudgmentThresholdJson, JudgmentType } from "./judgmentCards";

export type DecisionOutcome = "success" | "regret" | "neutral";

export type DecisionProfileEntry = {
  decision_type: JudgmentType;
  outcome: DecisionOutcome;
  frame_type: string | null;
  genre: string | null;
  threshold_json?: JudgmentThresholdJson | null;
};

export type DecisionProfileRatio = {
  count: number;
  percentage: number;
};

export type DecisionProfileSegment = {
  key: string;
  label: string;
  count: number;
  successCount: number;
  regretCount: number;
  neutralCount: number;
  successRate: number;
  regretRate: number;
  neutralRate: number;
  useNowCount: number;
  watchCount: number;
  skipCount: number;
  useNowRate: number;
  watchRate: number;
  skipRate: number;
  dominantDecisionType: JudgmentType | null;
};

export type DecisionProfileInsight = {
  key: string;
  title: string;
  body: string;
  tone: "positive" | "caution" | "neutral";
  supportingCount: number;
};

export type PersonalDecisionHint = {
  key: string;
  text: string;
  tone: "positive" | "caution" | "neutral";
  supportingCount: number;
};

export type DecisionProfile = {
  totalDecisions: number;
  minimumHistoryMet: boolean;
  decisionRatios: Record<JudgmentType, DecisionProfileRatio>;
  outcomeRatios: Record<DecisionOutcome, DecisionProfileRatio>;
  decisionTypeStats: Record<JudgmentType, DecisionProfileSegment>;
  frameTypeStats: DecisionProfileSegment[];
  genreStats: DecisionProfileSegment[];
  signalStats: DecisionProfileSegment[];
  topGenres: DecisionProfileSegment[];
  regretGenres: DecisionProfileSegment[];
  bestFrameType: DecisionProfileSegment | null;
  riskyFrameType: DecisionProfileSegment | null;
  favoriteFrameTypes: DecisionProfileSegment[];
  insights: DecisionProfileInsight[];
};

type ThresholdSignalKey = keyof JudgmentThresholdJson;

type SegmentAccumulator = {
  key: string;
  label: string;
  count: number;
  successCount: number;
  regretCount: number;
  neutralCount: number;
  useNowCount: number;
  watchCount: number;
  skipCount: number;
};

type InsightCandidate = DecisionProfileInsight & {
  score: number;
};

type HintCandidate = PersonalDecisionHint & {
  score: number;
};

const EMPTY_RATIO: DecisionProfileRatio = {
  count: 0,
  percentage: 0
};

const SIGNAL_LABELS: Record<ThresholdSignalKey, string> = {
  price: "価格条件",
  play_time: "プレイ時間",
  watch_time: "視聴時間",
  monthly_cost: "月額コスト",
  ad_time: "広告時間",
  time_limit: "時間条件",
  unit_cost: "時間単価",
  ratio: "比率条件",
  other: "追加条件"
};

const DECISION_TYPE_LABELS: Record<JudgmentType, string> = {
  use_now: "採用",
  watch: "様子見",
  skip: "見送る"
};

const FRAME_TYPE_LABELS: Record<string, string> = {
  "Frame A": "使う時間で比較",
  "Frame B": "月額の見直し",
  "Frame C": "セール時の比較",
  "Frame D": "広告負担の見直し"
};

const GENRE_LABELS: Record<string, string> = {
  entertainment: "エンタメ",
  games: "エンタメ",
  streaming: "サブスク",
  anime: "エンタメ",
  movies: "エンタメ",
  movie: "エンタメ",
  tech: "テック",
  tools: "ツール",
  tool: "ツール",
  general: "生活",
  life: "生活",
  travel: "生活"
};

export const MIN_PROFILE_HISTORY = 5;
export const MIN_SEGMENT_HISTORY = 3;

const roundPercentage = (count: number, total: number): number => {
  if (total <= 0) return 0;
  return Math.round((count / total) * 100);
};

const createAccumulator = (key: string, label: string): SegmentAccumulator => ({
  key,
  label,
  count: 0,
  successCount: 0,
  regretCount: 0,
  neutralCount: 0,
  useNowCount: 0,
  watchCount: 0,
  skipCount: 0
});

const incrementAccumulator = (accumulator: SegmentAccumulator, entry: DecisionProfileEntry): void => {
  accumulator.count += 1;

  if (entry.outcome === "success") accumulator.successCount += 1;
  if (entry.outcome === "regret") accumulator.regretCount += 1;
  if (entry.outcome === "neutral") accumulator.neutralCount += 1;

  if (entry.decision_type === "use_now") accumulator.useNowCount += 1;
  if (entry.decision_type === "watch") accumulator.watchCount += 1;
  if (entry.decision_type === "skip") accumulator.skipCount += 1;
};

const toSegment = (accumulator: SegmentAccumulator): DecisionProfileSegment => {
  const decisionPairs = [
    ["use_now", accumulator.useNowCount],
    ["watch", accumulator.watchCount],
    ["skip", accumulator.skipCount]
  ] as const;
  const sortedDecisionPairs = [...decisionPairs].sort((left, right) => right[1] - left[1]);
  const dominantDecisionType = sortedDecisionPairs[0]?.[1] ? sortedDecisionPairs[0][0] : null;

  return {
    key: accumulator.key,
    label: accumulator.label,
    count: accumulator.count,
    successCount: accumulator.successCount,
    regretCount: accumulator.regretCount,
    neutralCount: accumulator.neutralCount,
    successRate: roundPercentage(accumulator.successCount, accumulator.count),
    regretRate: roundPercentage(accumulator.regretCount, accumulator.count),
    neutralRate: roundPercentage(accumulator.neutralCount, accumulator.count),
    useNowCount: accumulator.useNowCount,
    watchCount: accumulator.watchCount,
    skipCount: accumulator.skipCount,
    useNowRate: roundPercentage(accumulator.useNowCount, accumulator.count),
    watchRate: roundPercentage(accumulator.watchCount, accumulator.count),
    skipRate: roundPercentage(accumulator.skipCount, accumulator.count),
    dominantDecisionType
  };
};

const sortByCountDesc = (left: DecisionProfileSegment, right: DecisionProfileSegment): number => {
  if (right.count !== left.count) return right.count - left.count;
  if (right.successRate !== left.successRate) return right.successRate - left.successRate;
  return left.label.localeCompare(right.label, "ja");
};

const sortBySuccessStrength = (left: DecisionProfileSegment, right: DecisionProfileSegment): number => {
  if (right.successRate !== left.successRate) return right.successRate - left.successRate;
  if (right.successCount !== left.successCount) return right.successCount - left.successCount;
  return right.count - left.count;
};

const sortByRegretStrength = (left: DecisionProfileSegment, right: DecisionProfileSegment): number => {
  if (right.regretRate !== left.regretRate) return right.regretRate - left.regretRate;
  if (right.regretCount !== left.regretCount) return right.regretCount - left.regretCount;
  return right.count - left.count;
};

const collectSegments = (
  entries: DecisionProfileEntry[],
  selectValue: (entry: DecisionProfileEntry) => string | null | undefined
): DecisionProfileSegment[] => {
  const segments = entries.reduce((map, entry) => {
    const rawValue = selectValue(entry)?.trim();
    if (!rawValue) return map;

    const label = FRAME_TYPE_LABELS[rawValue] ?? GENRE_LABELS[rawValue] ?? rawValue;
    const accumulator = map.get(rawValue) ?? createAccumulator(rawValue, label);
    incrementAccumulator(accumulator, entry);
    map.set(rawValue, accumulator);
    return map;
  }, new Map<string, SegmentAccumulator>());

  return Array.from(segments.values()).map(toSegment).sort(sortByCountDesc);
};

const collectSignalSegments = (entries: DecisionProfileEntry[]): DecisionProfileSegment[] => {
  const segments = entries.reduce((map, entry) => {
    const thresholdJson = entry.threshold_json ?? {};
    const signalKeys = (Object.keys(SIGNAL_LABELS) as ThresholdSignalKey[]).filter((key) => {
      const value = thresholdJson[key];

      if (key === "other") {
        return Array.isArray(value) && value.length > 0;
      }

      return Array.isArray(value) && value.length > 0;
    });

    for (const signalKey of new Set(signalKeys)) {
      const accumulator = map.get(signalKey) ?? createAccumulator(signalKey, SIGNAL_LABELS[signalKey]);
      incrementAccumulator(accumulator, entry);
      map.set(signalKey, accumulator);
    }

    return map;
  }, new Map<string, SegmentAccumulator>());

  return Array.from(segments.values()).map(toSegment).sort(sortByCountDesc);
};

const createDecisionTypeSegment = (entries: DecisionProfileEntry[], judgmentType: JudgmentType): DecisionProfileSegment => {
  const accumulator = createAccumulator(judgmentType, DECISION_TYPE_LABELS[judgmentType]);

  for (const entry of entries) {
    if (entry.decision_type === judgmentType) {
      incrementAccumulator(accumulator, entry);
    }
  }

  return toSegment(accumulator);
};

const pickStrongestSuccessSegment = (segments: DecisionProfileSegment[]): DecisionProfileSegment | null => {
  return segments.filter((segment) => segment.count >= MIN_SEGMENT_HISTORY && segment.successCount > 0).sort(sortBySuccessStrength)[0] ?? null;
};

const pickStrongestRegretSegment = (segments: DecisionProfileSegment[]): DecisionProfileSegment | null => {
  return segments.filter((segment) => segment.count >= MIN_SEGMENT_HISTORY && segment.regretCount > 0).sort(sortByRegretStrength)[0] ?? null;
};

const buildInsightCandidates = (profile: DecisionProfile): InsightCandidate[] => {
  if (!profile.minimumHistoryMet) {
    return [];
  }

  const candidates: InsightCandidate[] = [];
  const bestFrame = profile.bestFrameType;
  if (bestFrame && bestFrame.successRate >= 67 && bestFrame.successCount >= 2) {
    candidates.push({
      key: `frame-success:${bestFrame.key}`,
      title: `${bestFrame.label} で満足しやすい`,
      body: `過去${bestFrame.count}件中${bestFrame.successCount}件が満足でした。この比較のしかたは自分に合いやすい傾向です。`,
      tone: "positive",
      supportingCount: bestFrame.count,
      score: bestFrame.successRate + bestFrame.count * 4
    });
  }

  const regretGenre = profile.genreStats
    .filter((segment) => segment.count >= MIN_SEGMENT_HISTORY && segment.regretRate >= 50 && segment.regretCount >= 2)
    .sort(sortByRegretStrength)[0];
  if (regretGenre) {
    candidates.push({
      key: `genre-regret:${regretGenre.key}`,
      title: `${regretGenre.label} は後悔が多め`,
      body: `過去${regretGenre.count}件中${regretGenre.regretCount}件で後悔がありました。このジャンルは条件を厳しく見たほうが安定します。`,
      tone: "caution",
      supportingCount: regretGenre.count,
      score: regretGenre.regretRate + regretGenre.count * 4
    });
  }

  const useNowGenre = profile.genreStats
    .filter((segment) => segment.count >= MIN_SEGMENT_HISTORY && segment.useNowRate >= 60 && segment.useNowCount >= 2)
    .sort((left, right) => {
      if (right.useNowRate !== left.useNowRate) return right.useNowRate - left.useNowRate;
      if (right.useNowCount !== left.useNowCount) return right.useNowCount - left.useNowCount;
      return right.count - left.count;
    })[0];
  if (useNowGenre) {
    candidates.push({
      key: `genre-use-now:${useNowGenre.key}`,
      title: `${useNowGenre.label} ではすぐ決めることが多い`,
      body: `過去${useNowGenre.count}件中${useNowGenre.useNowCount}件で採用を選んでいます。このカテゴリは即断しやすい傾向です。`,
      tone: "neutral",
      supportingCount: useNowGenre.count,
      score: useNowGenre.useNowRate + useNowGenre.count * 3
    });
  }

  const watchPattern = profile.decisionTypeStats.watch;
  if (watchPattern.count >= MIN_SEGMENT_HISTORY && watchPattern.regretRate >= 40 && watchPattern.regretCount >= 2) {
    candidates.push({
      key: "decision-watch-regret",
      title: "様子見にした項目は後悔しやすい傾向があります",
      body: `様子見を選んだ${watchPattern.count}件のうち${watchPattern.regretCount}件で後悔がありました。保留のままにせず、見直し条件を明確にすると改善しやすくなります。`,
      tone: "caution",
      supportingCount: watchPattern.count,
      score: watchPattern.regretRate + watchPattern.count * 3
    });
  }

  const regretSignal = profile.signalStats
    .filter((segment) => segment.count >= MIN_SEGMENT_HISTORY && segment.regretRate >= 50 && segment.regretCount >= 2)
    .sort(sortByRegretStrength)[0];
  if (regretSignal) {
    candidates.push({
      key: `signal-regret:${regretSignal.key}`,
      title: `${regretSignal.label} を含むトピックは慎重に見る`,
      body: `${regretSignal.label}が出ていた${regretSignal.count}件のうち${regretSignal.regretCount}件で後悔がありました。この条件があるトピックは比較を増やす余地があります。`,
      tone: "caution",
      supportingCount: regretSignal.count,
      score: regretSignal.regretRate + regretSignal.count * 2
    });
  }

  return candidates.sort((left, right) => right.score - left.score);
};

export const buildPersonalDecisionProfile = (entries: DecisionProfileEntry[]): DecisionProfile => {
  const totalDecisions = entries.length;
  const successCount = entries.filter((entry) => entry.outcome === "success").length;
  const regretCount = entries.filter((entry) => entry.outcome === "regret").length;
  const neutralCount = entries.filter((entry) => entry.outcome === "neutral").length;
  const useNowCount = entries.filter((entry) => entry.decision_type === "use_now").length;
  const watchCount = entries.filter((entry) => entry.decision_type === "watch").length;
  const skipCount = entries.filter((entry) => entry.decision_type === "skip").length;

  const frameTypeStats = collectSegments(entries, (entry) => entry.frame_type);
  const genreStats = collectSegments(entries, (entry) => entry.genre);
  const signalStats = collectSignalSegments(entries);
  const decisionTypeStats = {
    use_now: createDecisionTypeSegment(entries, "use_now"),
    watch: createDecisionTypeSegment(entries, "watch"),
    skip: createDecisionTypeSegment(entries, "skip")
  };

  const favoriteFrameTypes = frameTypeStats.filter((segment) => segment.successCount > 0).sort(sortBySuccessStrength).slice(0, 3);
  const bestFrameType = pickStrongestSuccessSegment(frameTypeStats);
  const riskyFrameType = pickStrongestRegretSegment(frameTypeStats);
  const profile: DecisionProfile = {
    totalDecisions,
    minimumHistoryMet: totalDecisions >= MIN_PROFILE_HISTORY,
    decisionRatios: {
      use_now: {
        count: useNowCount,
        percentage: roundPercentage(useNowCount, totalDecisions)
      },
      watch: {
        count: watchCount,
        percentage: roundPercentage(watchCount, totalDecisions)
      },
      skip: {
        count: skipCount,
        percentage: roundPercentage(skipCount, totalDecisions)
      }
    },
    outcomeRatios: {
      success: {
        count: successCount,
        percentage: roundPercentage(successCount, totalDecisions)
      },
      regret: {
        count: regretCount,
        percentage: roundPercentage(regretCount, totalDecisions)
      },
      neutral: {
        count: neutralCount,
        percentage: roundPercentage(neutralCount, totalDecisions)
      }
    },
    decisionTypeStats,
    frameTypeStats,
    genreStats,
    signalStats,
    topGenres: genreStats.slice(0, 3),
    regretGenres: genreStats.filter((segment) => segment.regretCount > 0).sort(sortByRegretStrength).slice(0, 3),
    bestFrameType,
    riskyFrameType,
    favoriteFrameTypes,
    insights: []
  };

  profile.insights = buildInsightCandidates(profile).slice(0, 3);
  return profile;
};

const createEmptyProfile = (): DecisionProfile => {
  const emptySegment = (label: string, key: string): DecisionProfileSegment =>
    toSegment({
      ...createAccumulator(key, label),
      key,
      label
    });

  return {
    totalDecisions: 0,
    minimumHistoryMet: false,
    decisionRatios: {
      use_now: EMPTY_RATIO,
      watch: EMPTY_RATIO,
      skip: EMPTY_RATIO
    },
    outcomeRatios: {
      success: EMPTY_RATIO,
      regret: EMPTY_RATIO,
      neutral: EMPTY_RATIO
    },
    decisionTypeStats: {
      use_now: emptySegment(DECISION_TYPE_LABELS.use_now, "use_now"),
      watch: emptySegment(DECISION_TYPE_LABELS.watch, "watch"),
      skip: emptySegment(DECISION_TYPE_LABELS.skip, "skip")
    },
    frameTypeStats: [],
    genreStats: [],
    signalStats: [],
    topGenres: [],
    regretGenres: [],
    bestFrameType: null,
    riskyFrameType: null,
    favoriteFrameTypes: [],
    insights: []
  };
};

export const EMPTY_DECISION_PROFILE = createEmptyProfile();

export const buildPersonalDecisionHint = (params: {
  card: {
    frame_type?: string | null;
    genre?: string | null;
    judgment_type?: JudgmentType;
    threshold_json?: JudgmentThresholdJson | null;
  };
  profile: DecisionProfile;
}): PersonalDecisionHint | null => {
  const { card, profile } = params;
  if (!profile.minimumHistoryMet) {
    return null;
  }

  const candidates: HintCandidate[] = [];

  if (card.frame_type) {
    const frameStat = profile.frameTypeStats.find((segment) => segment.key === card.frame_type);
    if (frameStat && frameStat.count >= MIN_SEGMENT_HISTORY) {
      if (frameStat.regretRate >= 50 && frameStat.regretCount >= 2) {
        candidates.push({
          key: `frame-regret:${frameStat.key}`,
          text: `あなたは「${frameStat.label}」で後悔が多めです。過去${frameStat.count}件中${frameStat.regretCount}件で後悔がありました。`,
          tone: "caution",
          supportingCount: frameStat.count,
          score: frameStat.regretRate + frameStat.count * 5
        });
      }

      if (frameStat.successRate >= 67 && frameStat.successCount >= 2) {
        candidates.push({
          key: `frame-success:${frameStat.key}`,
          text: `あなたは「${frameStat.label}」で満足が多めです。過去${frameStat.count}件中${frameStat.successCount}件が満足でした。`,
          tone: "positive",
          supportingCount: frameStat.count,
          score: frameStat.successRate + frameStat.count * 5
        });
      }
    }
  }

  if (card.genre) {
    const genreStat = profile.genreStats.find((segment) => segment.key === card.genre);
    if (genreStat && genreStat.count >= MIN_SEGMENT_HISTORY) {
      if (genreStat.regretRate >= 50 && genreStat.regretCount >= 2) {
        candidates.push({
          key: `genre-regret:${genreStat.key}`,
          text: `${genreStat.label} は過去${genreStat.count}件中${genreStat.regretCount}件で後悔がありました。少し慎重に見る余地があります。`,
          tone: "caution",
          supportingCount: genreStat.count,
          score: genreStat.regretRate + genreStat.count * 4
        });
      }

      if (genreStat.useNowRate >= 60 && genreStat.useNowCount >= 2) {
        candidates.push({
          key: `genre-use-now:${genreStat.key}`,
          text: `${genreStat.label} は採用が多めです。過去${genreStat.count}件中${genreStat.useNowCount}件で優先して決めています。`,
          tone: "neutral",
          supportingCount: genreStat.count,
          score: genreStat.useNowRate + genreStat.count * 3
        });
      }
    }
  }

  const thresholdJson = card.threshold_json ?? {};
  const signalKeys = (Object.keys(SIGNAL_LABELS) as ThresholdSignalKey[]).filter((key) => {
    const value = thresholdJson[key];

    if (key === "other") {
      return Array.isArray(value) && value.length > 0;
    }

    return Array.isArray(value) && value.length > 0;
  });

  for (const signalKey of signalKeys) {
    const signalStat = profile.signalStats.find((segment) => segment.key === signalKey);
    if (!signalStat || signalStat.count < MIN_SEGMENT_HISTORY) continue;

    if (signalStat.regretRate >= 50 && signalStat.regretCount >= 2) {
      candidates.push({
        key: `signal-regret:${signalStat.key}`,
        text: `${signalStat.label} を含むトピックは過去${signalStat.count}件中${signalStat.regretCount}件で後悔がありました。条件確認を厚めにすると安定しやすいです。`,
        tone: "caution",
        supportingCount: signalStat.count,
        score: signalStat.regretRate + signalStat.count * 2
      });
    }

    if (signalStat.successRate >= 67 && signalStat.successCount >= 2) {
      candidates.push({
        key: `signal-success:${signalStat.key}`,
        text: `${signalStat.label} を含むトピックは満足が多めです。過去${signalStat.count}件中${signalStat.successCount}件が満足でした。`,
        tone: "positive",
        supportingCount: signalStat.count,
        score: signalStat.successRate + signalStat.count * 2
      });
    }
  }

  if (card.judgment_type) {
    const typeStat = profile.decisionTypeStats[card.judgment_type];
    if (typeStat.count >= MIN_SEGMENT_HISTORY) {
      if (typeStat.regretRate >= 50 && typeStat.regretCount >= 2) {
        candidates.push({
          key: `decision-regret:${card.judgment_type}`,
          text: `${DECISION_TYPE_LABELS[card.judgment_type]} を選んだアクションは、過去${typeStat.count}件中${typeStat.regretCount}件で後悔がありました。`,
          tone: "caution",
          supportingCount: typeStat.count,
          score: typeStat.regretRate + typeStat.count
        });
      }

      if (typeStat.successRate >= 67 && typeStat.successCount >= 2) {
        candidates.push({
          key: `decision-success:${card.judgment_type}`,
          text: `${DECISION_TYPE_LABELS[card.judgment_type]} を選んだアクションは、過去${typeStat.count}件中${typeStat.successCount}件で満足でした。`,
          tone: "positive",
          supportingCount: typeStat.count,
          score: typeStat.successRate + typeStat.count
        });
      }
    }
  }

  return candidates.sort((left, right) => right.score - left.score)[0] ?? null;
};
