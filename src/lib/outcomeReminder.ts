import type { JudgmentType } from "./judgmentCards";

export type OutcomeReminderDecision = {
  id: string;
  judgment_card_id: string;
  episode_id: string;
  topic_title: string;
  frame_type: string | null;
  genre: string | null;
  decision_type: JudgmentType;
  outcome: "success" | "regret" | "neutral" | null;
  created_at: string;
  deadline_at: string | null;
};

export type OutcomeReminderReason = "deadline_passed" | "elapsed_days";

export type OutcomeReminderCandidate = OutcomeReminderDecision & {
  reason: OutcomeReminderReason;
  elapsed_days: number;
  days_past_deadline: number | null;
  priority_score: number;
};

export type OutcomeReminderOptions = {
  now?: Date;
  minimumElapsedDays?: number;
};

export const DEFAULT_OUTCOME_REMINDER_DAYS = 3;
export const FREE_OUTCOME_REMINDER_LIMIT = 3;

const DAY_IN_MS = 24 * 60 * 60 * 1000;

const PRIORITY_BY_DECISION_TYPE: Record<JudgmentType, number> = {
  use_now: 40,
  watch: 24,
  skip: 8
};

const toDate = (value: string | null): Date | null => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const startOfDay = (date: Date): number => {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
};

const diffInWholeDays = (from: Date, to: Date): number => {
  return Math.floor((startOfDay(to) - startOfDay(from)) / DAY_IN_MS);
};

const buildPriorityScore = (decision: OutcomeReminderDecision, elapsedDays: number, daysPastDeadline: number | null): number => {
  const decisionTypeBase = PRIORITY_BY_DECISION_TYPE[decision.decision_type];
  const elapsedScore = Math.min(elapsedDays, 30);
  const deadlineScore = daysPastDeadline === null ? 0 : 80 + Math.min(daysPastDeadline, 30) * 3;

  return decisionTypeBase + elapsedScore + deadlineScore;
};

export const buildOutcomeReminderCandidates = (
  decisions: OutcomeReminderDecision[],
  options: OutcomeReminderOptions = {}
): OutcomeReminderCandidate[] => {
  const now = options.now ?? new Date();
  const minimumElapsedDays = options.minimumElapsedDays ?? DEFAULT_OUTCOME_REMINDER_DAYS;

  return decisions
    .flatMap((decision) => {
      if (decision.outcome !== null) {
        return [];
      }

      const createdAt = toDate(decision.created_at);
      if (!createdAt) {
        return [];
      }

      const elapsedDays = diffInWholeDays(createdAt, now);
      const deadlineAt = toDate(decision.deadline_at);
      const hasPassedDeadline = Boolean(deadlineAt && deadlineAt.getTime() <= now.getTime());
      const daysPastDeadline = deadlineAt && hasPassedDeadline ? Math.max(diffInWholeDays(deadlineAt, now), 0) : null;
      const eligibleByElapsedDays = elapsedDays >= minimumElapsedDays;

      if (!hasPassedDeadline && !eligibleByElapsedDays) {
        return [];
      }

      return [
        {
          ...decision,
          reason: hasPassedDeadline ? "deadline_passed" : "elapsed_days",
          elapsed_days: elapsedDays,
          days_past_deadline: daysPastDeadline,
          priority_score: buildPriorityScore(decision, elapsedDays, daysPastDeadline)
        } satisfies OutcomeReminderCandidate
      ];
    })
    .sort((left, right) => {
      if (right.priority_score !== left.priority_score) {
        return right.priority_score - left.priority_score;
      }

      return right.created_at.localeCompare(left.created_at);
    });
};

export const limitOutcomeReminderCandidates = (
  candidates: OutcomeReminderCandidate[],
  isPaid: boolean,
  freeLimit = FREE_OUTCOME_REMINDER_LIMIT
): OutcomeReminderCandidate[] => {
  return isPaid ? candidates : candidates.slice(0, freeLimit);
};

export const formatOutcomeReminderTiming = (candidate: OutcomeReminderCandidate): string => {
  if (candidate.reason === "deadline_passed") {
    if (candidate.days_past_deadline === 0) {
      return "期限を過ぎています";
    }

    return `期限から${candidate.days_past_deadline}日経過`;
  }

  return `保存から${candidate.elapsed_days}日経過`;
};
