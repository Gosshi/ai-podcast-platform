import type { DecisionProfile, DecisionProfileSegment } from "./decisionProfile";
import type { JudgmentThresholdJson, JudgmentType } from "./judgmentCards";
import type { UserPreferenceProfile } from "./userPreferences";

export type NextBestDecisionUrgencyLevel = "critical" | "high" | "medium" | "low";

export type NextBestDecisionCardInput = {
  id: string;
  episode_id: string;
  topic_title: string;
  judgment_type: JudgmentType;
  judgment_summary: string;
  action_text: string | null;
  deadline_at: string | null;
  ranking_deadline_at?: string | null;
  threshold_json: JudgmentThresholdJson;
  frame_type: string | null;
  genre: string | null;
  created_at: string;
  confidence_score?: number | null;
  is_saved?: boolean;
  saved_outcome?: "success" | "regret" | "neutral" | null;
};

export type NextBestDecisionRecommendation<T extends NextBestDecisionCardInput = NextBestDecisionCardInput> = {
  card: T;
  priority_score: number;
  reason_tags: string[];
  recommended_action: string;
  urgency_level: NextBestDecisionUrgencyLevel;
  deadline_label: string;
  personalization_context: {
    hasHistoryProfile: boolean;
    preferenceProfile: UserPreferenceProfile | null;
  };
};

type RankingContext = {
  score: number;
  reasonTags: string[];
};

const DAY_IN_MS = 24 * 60 * 60 * 1000;

const THRESHOLD_SIGNAL_LABELS: Record<keyof JudgmentThresholdJson, string> = {
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

const toTimestamp = (value: string | null | undefined): number => {
  if (!value) return Number.NaN;
  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? Number.NaN : timestamp;
};

const pushReasonTag = (reasonTags: string[], tag: string): void => {
  if (!reasonTags.includes(tag) && reasonTags.length < 4) {
    reasonTags.push(tag);
  }
};

const resolveDeadlineInfo = (
  deadlineAt: string | null,
  nowTimestamp: number,
  isPaid: boolean
): { score: number; deadlineLabel: string; urgencyLevel: NextBestDecisionUrgencyLevel; tag: string | null } => {
  const timestamp = toTimestamp(deadlineAt);
  if (Number.isNaN(timestamp)) {
    return {
      score: 0,
      deadlineLabel: "期限未設定",
      urgencyLevel: "low",
      tag: null
    };
  }

  const daysUntil = Math.ceil((timestamp - nowTimestamp) / DAY_IN_MS);

  if (daysUntil <= 0) {
    return {
      score: 82,
      deadlineLabel: isPaid ? deadlineAt ?? "今日が期限" : "今日中に確認",
      urgencyLevel: "critical",
      tag: "締切が近い"
    };
  }

  if (daysUntil <= 1) {
    return {
      score: 70,
      deadlineLabel: isPaid ? deadlineAt ?? "24時間以内" : "24時間以内に確認",
      urgencyLevel: "critical",
      tag: "締切が近い"
    };
  }

  if (daysUntil <= 3) {
    return {
      score: 54,
      deadlineLabel: isPaid ? deadlineAt ?? "3日以内" : "3日以内に確認",
      urgencyLevel: "high",
      tag: "今週前半に判断"
    };
  }

  if (daysUntil <= 7) {
    return {
      score: 36,
      deadlineLabel: isPaid ? deadlineAt ?? "今週中" : "今週中に確認",
      urgencyLevel: "medium",
      tag: "今週中に確認"
    };
  }

  if (daysUntil <= 14) {
    return {
      score: 18,
      deadlineLabel: isPaid ? deadlineAt ?? "2週間以内" : "期限あり",
      urgencyLevel: "medium",
      tag: "期限つき"
    };
  }

  return {
    score: 8,
    deadlineLabel: isPaid ? deadlineAt ?? "期限あり" : "期限あり",
    urgencyLevel: "low",
    tag: "期限つき"
  };
};

const resolveJudgmentTypeScore = (
  judgmentType: JudgmentType,
  hasDeadline: boolean
): { score: number; urgencyLevel: NextBestDecisionUrgencyLevel; tag: string } => {
  switch (judgmentType) {
    case "use_now":
      return {
        score: 62,
        urgencyLevel: "high",
        tag: "今すぐ使える"
      };
    case "watch":
      return {
        score: hasDeadline ? 34 : 20,
        urgencyLevel: hasDeadline ? "high" : "medium",
        tag: hasDeadline ? "期限つきで見直し" : "条件が動いたら見直し"
      };
    case "skip":
      return {
        score: -18,
        urgencyLevel: "low",
        tag: "見送り候補"
      };
  }
};

const resolveRecencyScore = (createdAt: string, nowTimestamp: number): number => {
  const timestamp = toTimestamp(createdAt);
  if (Number.isNaN(timestamp)) return 0;

  const ageDays = Math.floor((nowTimestamp - timestamp) / DAY_IN_MS);
  if (ageDays <= 1) return 10;
  if (ageDays <= 3) return 6;
  if (ageDays <= 7) return 3;
  return 0;
};

const resolveRecommendedAction = (card: NextBestDecisionCardInput): string => {
  if (card.action_text) {
    return card.action_text;
  }

  switch (card.judgment_type) {
    case "use_now":
      return "今日中に使うかを決める";
    case "watch":
      return card.ranking_deadline_at ? "期限までに条件を見直す" : "条件が動いたら再確認する";
    case "skip":
      return "今回は見送り、他の候補を優先する";
  }
};

const resolveSignalMatches = (
  thresholdJson: JudgmentThresholdJson,
  signals: DecisionProfileSegment[]
): DecisionProfileSegment[] => {
  const signalKeys = (Object.keys(THRESHOLD_SIGNAL_LABELS) as Array<keyof JudgmentThresholdJson>).filter((key) => {
    const value = thresholdJson[key];
    return Array.isArray(value) && value.length > 0;
  });

  return signalKeys
    .map((signalKey) => signals.find((segment) => segment.key === signalKey))
    .filter((segment): segment is DecisionProfileSegment => Boolean(segment));
};

const resolvePersonalizationScore = (
  card: NextBestDecisionCardInput,
  profile: DecisionProfile | null | undefined
): RankingContext => {
  if (!profile?.minimumHistoryMet) {
    return {
      score: 0,
      reasonTags: []
    };
  }

  const result: RankingContext = {
    score: 0,
    reasonTags: []
  };

  const frameStat = card.frame_type
    ? profile.frameTypeStats.find((segment) => segment.key === card.frame_type)
    : null;
  if (frameStat?.count && frameStat.count >= 3) {
    if (frameStat.regretRate >= 50 && frameStat.regretCount >= 2) {
      result.score += 28;
      pushReasonTag(result.reasonTags, "あなたはこのタイプで後悔しやすい");
      pushReasonTag(result.reasonTags, "後悔防止");
    } else if (frameStat.successRate >= 67 && frameStat.successCount >= 2) {
      result.score += 14;
      pushReasonTag(result.reasonTags, "得意なフレーム");
    }
  }

  const genreStat = card.genre ? profile.genreStats.find((segment) => segment.key === card.genre) : null;
  if (genreStat?.count && genreStat.count >= 3) {
    if (genreStat.successRate >= 60 && genreStat.successCount >= 2) {
      result.score += 18;
      pushReasonTag(result.reasonTags, "満足率が高い分野");
    }

    if (genreStat.regretRate >= 50 && genreStat.regretCount >= 2) {
      result.score += 16;
      pushReasonTag(result.reasonTags, "後悔しやすい分野");
    }
  }

  const regretSignals = resolveSignalMatches(card.threshold_json, profile.signalStats)
    .filter((segment) => segment.count >= 3 && segment.regretRate >= 50 && segment.regretCount >= 2)
    .sort((left, right) => right.regretRate - left.regretRate);
  if (regretSignals[0]) {
    result.score += 16;
    pushReasonTag(result.reasonTags, "後悔しやすい条件に近い");
  }

  if (
    card.judgment_type === "watch" &&
    profile.decisionTypeStats.watch.count >= 3 &&
    profile.decisionTypeStats.watch.regretRate >= 40 &&
    profile.decisionTypeStats.watch.regretCount >= 2
  ) {
    result.score += 14;
    pushReasonTag(result.reasonTags, "先延ばし注意");
  }

  return result;
};

const resolveUrgencyLevel = (
  judgmentUrgency: NextBestDecisionUrgencyLevel,
  deadlineUrgency: NextBestDecisionUrgencyLevel
): NextBestDecisionUrgencyLevel => {
  const priority: Record<NextBestDecisionUrgencyLevel, number> = {
    critical: 4,
    high: 3,
    medium: 2,
    low: 1
  };

  return priority[deadlineUrgency] >= priority[judgmentUrgency] ? deadlineUrgency : judgmentUrgency;
};

export const rankNextBestDecisions = <T extends NextBestDecisionCardInput>(params: {
  cards: T[];
  isPaid: boolean;
  profile?: DecisionProfile | null;
  preferenceProfile?: UserPreferenceProfile | null;
  now?: Date;
  limit?: number;
}): NextBestDecisionRecommendation<T>[] => {
  const nowTimestamp = (params.now ?? new Date()).getTime();

  return [...params.cards]
    .map((card) => {
      const rankingDeadlineAt = card.ranking_deadline_at ?? card.deadline_at ?? null;
      const deadline = resolveDeadlineInfo(rankingDeadlineAt, nowTimestamp, params.isPaid);
      const judgment = resolveJudgmentTypeScore(card.judgment_type, Boolean(rankingDeadlineAt));
      const personal = params.isPaid ? resolvePersonalizationScore(card, params.profile) : { score: 0, reasonTags: [] };

      const reasonTags: string[] = [];
      if (deadline.tag) pushReasonTag(reasonTags, deadline.tag);

      if (personal.reasonTags.length > 0) {
        pushReasonTag(reasonTags, "あなた向け");
      }

      for (const tag of personal.reasonTags) {
        pushReasonTag(reasonTags, tag);
      }

      pushReasonTag(reasonTags, judgment.tag);

      const confidenceScore = typeof card.confidence_score === "number" ? Math.max(card.confidence_score, 0) : 0;
      const priorityScore =
        deadline.score +
        judgment.score +
        resolveRecencyScore(card.created_at, nowTimestamp) +
        Math.round(confidenceScore * 12) +
        personal.score +
        (card.is_saved ? -40 : 0) +
        (card.saved_outcome === "success" ? -20 : 0);

      return {
        card,
        priority_score: priorityScore,
        reason_tags: reasonTags,
        recommended_action: resolveRecommendedAction(card),
        urgency_level: resolveUrgencyLevel(judgment.urgencyLevel, deadline.urgencyLevel),
        deadline_label: deadline.deadlineLabel,
        personalization_context: {
          hasHistoryProfile: Boolean(params.profile?.minimumHistoryMet),
          preferenceProfile: params.preferenceProfile ?? null
        },
        deadline_rank: toTimestamp(rankingDeadlineAt)
      };
    })
    .sort((left, right) => {
      if (right.priority_score !== left.priority_score) {
        return right.priority_score - left.priority_score;
      }

      const leftDeadline = Number.isNaN(left.deadline_rank) ? Number.POSITIVE_INFINITY : left.deadline_rank;
      const rightDeadline = Number.isNaN(right.deadline_rank) ? Number.POSITIVE_INFINITY : right.deadline_rank;
      if (leftDeadline !== rightDeadline) {
        return leftDeadline - rightDeadline;
      }

      return right.card.created_at.localeCompare(left.card.created_at);
    })
    .slice(0, params.limit ?? (params.isPaid ? 3 : 1))
    .map(({ deadline_rank, ...recommendation }) => recommendation);
};
