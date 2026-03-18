/**
 * Shared label constants used across the application.
 *
 * Context-specific label variants:
 * - JUDGMENT_TYPE_BADGE_LABELS: for card badge display ("おすすめ: 今すぐ")
 *   → used in uiText.ts and GenerateCardForm
 * - DECISION_TYPE_LABELS (decisionHistory.ts): short labels ("今すぐ") for history
 * - DECISION_TYPE_LABELS (decisionProfile.ts): analysis labels ("採用")
 *
 * These intentional differences are documented here but kept in their
 * respective files since the context determines the wording.
 */

import type { JudgmentType } from "./judgmentCards";

// ---------------------------------------------------------------------------
// Outcome labels (shared across history, profile, and generated cards)
// ---------------------------------------------------------------------------
export type DecisionOutcomeValue = "success" | "regret" | "neutral";

export const OUTCOME_LABELS: Record<DecisionOutcomeValue, string> = {
  success: "満足",
  regret: "後悔",
  neutral: "普通"
};

// ---------------------------------------------------------------------------
// Genre labels (comprehensive mapping for display)
// ---------------------------------------------------------------------------
export const GENRE_LABELS: Record<string, string> = {
  entertainment: "エンタメ",
  games: "エンタメ",
  anime: "エンタメ",
  movies: "エンタメ",
  movie: "エンタメ",
  drama: "エンタメ",
  streaming: "サブスク",
  subscription: "サブスク",
  shopping: "買い物",
  lifestyle: "生活",
  work: "仕事",
  tools: "ツール",
  tool: "ツール",
  tech: "テック",
  technology: "テック",
  general: "生活",
  life: "生活",
  travel: "生活",
  personal: "生活",
  productivity: "生活"
};

// ---------------------------------------------------------------------------
// Frame type labels (comparison method descriptions)
// ---------------------------------------------------------------------------
export const FRAME_TYPE_LABELS: Record<string, string> = {
  "Frame A": "使う時間で比較",
  "Frame B": "月額の見直し",
  "Frame C": "セール時の比較",
  "Frame D": "広告負担の見直し"
};

// ---------------------------------------------------------------------------
// Judgment type badge labels (for card display with "おすすめ:" prefix)
// ---------------------------------------------------------------------------
export const JUDGMENT_TYPE_BADGE_LABELS: Record<JudgmentType, string> = {
  use_now: "おすすめ: 今すぐ",
  watch: "おすすめ: 様子見",
  skip: "おすすめ: 見送り"
};
