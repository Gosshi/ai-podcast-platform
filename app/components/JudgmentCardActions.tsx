import { buildDecisionReplayPath } from "@/app/lib/decisionReplay";
import { formatDecisionOutcomeLabel, type DecisionOutcome } from "@/app/lib/decisionHistory";
import { resolveJudgmentCardActionState } from "@/app/lib/judgmentCardState";
import type { ViewerState } from "@/app/lib/viewer";
import type { JudgmentType } from "@/src/lib/judgmentCards";
import type { WatchlistStatus } from "@/src/lib/watchlist";
import SaveDecisionButton from "./SaveDecisionButton";
import SkipCardButton from "./SkipCardButton";
import TrackedLink from "./TrackedLink";
import styles from "./judgment-card-actions.module.css";

type JudgmentCardActionsProps = {
  judgmentCardId: string | undefined;
  viewer: ViewerState | null;
  initialItemId: string | null;
  initialStatus: WatchlistStatus | null;
  savedDecisionId: string | null;
  savedOutcome: DecisionOutcome;
  page: string;
  source: string;
  episodeId?: string;
  genre?: string | null;
  frameType?: string | null;
  judgmentType?: JudgmentType;
};

export default function JudgmentCardActions({
  judgmentCardId,
  viewer,
  initialItemId,
  initialStatus,
  savedDecisionId,
  savedOutcome,
  page,
  source,
  episodeId,
  genre,
  frameType,
  judgmentType
}: JudgmentCardActionsProps) {
  const actionState = resolveJudgmentCardActionState({
    savedDecisionId,
    savedOutcome
  });

  if (actionState === "recorded" && savedDecisionId) {
    return (
      <div className={styles.panel}>
        <TrackedLink
          href={buildDecisionReplayPath(savedDecisionId)}
          className={`${styles.statusLink} ${styles.statusLinkRecorded}`.trim()}
          eventName="decision_action_click"
          eventProperties={{
            page,
            source,
            action_name: "view_learning",
            decision_id: savedDecisionId,
            episode_id: episodeId,
            judgment_card_id: judgmentCardId,
            genre: genre ?? undefined,
            frame_type: frameType ?? undefined,
            judgment_type: judgmentType,
            outcome: savedOutcome ?? undefined
          }}
        >
          学びを見る
        </TrackedLink>
        <p className={styles.metaText}>結果は「{formatDecisionOutcomeLabel(savedOutcome)}」として記録済みです。</p>
      </div>
    );
  }

  if (actionState === "adopted" && savedDecisionId) {
    return (
      <div className={styles.panel}>
        <TrackedLink
          href={`/history#decision-${savedDecisionId}`}
          className={styles.statusLink}
          eventName="decision_action_click"
          eventProperties={{
            page,
            source,
            action_name: "record_outcome",
            decision_id: savedDecisionId,
            episode_id: episodeId,
            judgment_card_id: judgmentCardId,
            genre: genre ?? undefined,
            frame_type: frameType ?? undefined,
            judgment_type: judgmentType
          }}
        >
          結果を記録する
        </TrackedLink>
        <p className={styles.metaText}>採用済みです。満足 / 普通 / 後悔をあとで記録できます。</p>
      </div>
    );
  }

  return (
    <div className={styles.buttonRow}>
      <SaveDecisionButton
        judgmentCardId={judgmentCardId}
        viewer={viewer}
        initialSaved={false}
        page={page}
        source={source}
        episodeId={episodeId}
        genre={genre}
        frameType={frameType}
        judgmentType={judgmentType}
        buttonLabel="採用する"
        loginButtonLabel="ログインして採用する"
        showHint={false}
      />
      <SkipCardButton
        judgmentCardId={judgmentCardId}
        viewer={viewer}
        initialItemId={initialItemId}
        initialStatus={initialStatus}
        page={page}
        source={source}
        episodeId={episodeId}
        genre={genre}
        frameType={frameType}
        judgmentType={judgmentType}
      />
    </div>
  );
}
