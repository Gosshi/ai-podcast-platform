import type { DecisionOutcome } from "./decisionHistory";

export type JudgmentCardActionState = "undecided" | "adopted" | "recorded";

export const resolveJudgmentCardActionState = (params: {
  savedDecisionId: string | null;
  savedOutcome: DecisionOutcome;
}): JudgmentCardActionState => {
  if (params.savedDecisionId && params.savedOutcome) {
    return "recorded";
  }

  if (params.savedDecisionId) {
    return "adopted";
  }

  return "undecided";
};

