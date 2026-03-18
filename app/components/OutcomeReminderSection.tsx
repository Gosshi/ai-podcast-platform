import AnalyticsEventOnRender from "@/app/components/AnalyticsEventOnRender";
import DecisionOutcomeSelect from "@/app/components/DecisionOutcomeSelect";
import TrackedLink from "@/app/components/TrackedLink";
import { DECISION_TYPE_LABELS, formatDecisionHistoryDate } from "@/app/lib/decisionHistory";
import { formatFrameTypeLabel, formatTopicTitle } from "@/app/lib/uiText";
import {
  formatOutcomeReminderTiming,
  type OutcomeReminderCandidate
} from "@/src/lib/outcomeReminder";
import styles from "./outcome-reminder-section.module.css";

type OutcomeReminderSectionProps = {
  reminders: OutcomeReminderCandidate[];
  hiddenCount?: number;
  isPaid: boolean;
  page: "/decisions" | "/history";
};

const buildHistoryAnchor = (decisionId: string): string => {
  return `/history#decision-${decisionId}`;
};

export default function OutcomeReminderSection({
  reminders,
  hiddenCount = 0,
  isPaid,
  page
}: OutcomeReminderSectionProps) {
  if (reminders.length === 0) {
    return null;
  }

  const sectionSource = page === "/decisions" ? "decisions_outcome_reminders" : "history_outcome_reminders";

  return (
    <section className={styles.section}>
      <div className={styles.header}>
        <div>
          <p className={styles.eyebrow}>結果の記録</p>
          <h2>結果を記録してください</h2>
          <p className={styles.lead}>
            アクションして終わりではなく、結果を残して次のおすすめに活かします。
          </p>
        </div>
        <span className={styles.countBadge}>{reminders.length}件</span>
      </div>

      <div className={styles.list}>
        {reminders.map((reminder, index) => (
          <article key={reminder.id} className={styles.card}>
            <AnalyticsEventOnRender
              eventName="outcome_reminder_impression"
              properties={{
                page,
                source: sectionSource,
                decision_id: reminder.id,
                episode_id: reminder.episode_id,
                judgment_card_id: reminder.judgment_card_id,
                genre: reminder.genre ?? undefined,
                frame_type: reminder.frame_type ?? undefined,
                judgment_type: reminder.decision_type,
                reminder_reason: reminder.reason,
                elapsed_days: reminder.elapsed_days,
                days_past_deadline: reminder.days_past_deadline,
                reminder_rank: index + 1
              }}
            />

            <div className={styles.cardHeader}>
              <div>
                <p className={styles.cardEyebrow}>{formatFrameTypeLabel(reminder.frame_type)}</p>
                <h3>{formatTopicTitle(reminder.topic_title)}</h3>
              </div>
              <span className={`${styles.badge} ${styles[`badge_${reminder.decision_type}`]}`.trim()}>
                {DECISION_TYPE_LABELS[reminder.decision_type]}
              </span>
            </div>

            <dl className={styles.metaGrid}>
              <div>
                <dt>記録日</dt>
                <dd>{formatDecisionHistoryDate(reminder.created_at)}</dd>
              </div>
              <div>
                <dt>状況</dt>
                <dd>{formatOutcomeReminderTiming(reminder)}</dd>
              </div>
              <div>
                <dt>アクション</dt>
                <dd>{DECISION_TYPE_LABELS[reminder.decision_type]}</dd>
              </div>
              <div>
                <dt>次にすること</dt>
                <dd>1クリックで結果を残せます</dd>
              </div>
            </dl>

            <div className={styles.actionBlock}>
              <div>
                <p className={styles.actionLabel}>かんたん結果記録</p>
                <p className={styles.actionCopy}>満足 / 後悔 / 普通 をその場で記録</p>
              </div>
              <DecisionOutcomeSelect
                decisionId={reminder.id}
                initialOutcome={null}
                page={page}
                source="outcome_reminder_quick_submit"
                episodeId={reminder.episode_id}
                judgmentCardId={reminder.judgment_card_id}
                genre={reminder.genre}
                frameType={reminder.frame_type}
                judgmentType={reminder.decision_type}
                variant="quick"
              />
            </div>

            <div className={styles.linkRow}>
              <TrackedLink
                href={buildHistoryAnchor(reminder.id)}
                className={styles.secondaryLink}
                eventName="outcome_reminder_click"
                eventProperties={{
                  page,
                  source: sectionSource,
                  destination: "history",
                  decision_id: reminder.id,
                  episode_id: reminder.episode_id,
                  judgment_card_id: reminder.judgment_card_id,
                  genre: reminder.genre ?? undefined,
                  frame_type: reminder.frame_type ?? undefined,
                  judgment_type: reminder.decision_type,
                  reminder_reason: reminder.reason
                }}
              >
                実行したアクションを見る
              </TrackedLink>
              <TrackedLink
                href={`/decisions/${reminder.episode_id}`}
                className={styles.primaryLink}
                eventName="outcome_reminder_to_replay_click"
                eventProperties={{
                  page,
                  source: sectionSource,
                  destination: "replay",
                  decision_id: reminder.id,
                  episode_id: reminder.episode_id,
                  judgment_card_id: reminder.judgment_card_id,
                  genre: reminder.genre ?? undefined,
                  frame_type: reminder.frame_type ?? undefined,
                  judgment_type: reminder.decision_type,
                  reminder_reason: reminder.reason
                }}
              >
                学びを見る
              </TrackedLink>
            </div>
          </article>
        ))}
      </div>

      {!isPaid && hiddenCount > 0 ? (
        <div className={styles.footnote}>
          <p>無料版では {reminders.length} 件まで表示しています。残り {hiddenCount} 件は有料版でまとめて確認できます。</p>
          <TrackedLink
            href="/account"
            className={styles.upgradeLink}
            eventName="subscribe_cta_click"
            eventProperties={{
              page,
              source: `${sectionSource}_upgrade`
            }}
          >
            すべて確認する
          </TrackedLink>
        </div>
      ) : null}
    </section>
  );
}
