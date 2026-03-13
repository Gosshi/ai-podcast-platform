import AnalyticsPageView from "@/app/components/AnalyticsPageView";
import DecisionOutcomeSelect from "@/app/components/DecisionOutcomeSelect";
import MemberControls from "@/app/components/MemberControls";
import OutcomeReminderSection from "@/app/components/OutcomeReminderSection";
import RemoveDecisionButton from "@/app/components/RemoveDecisionButton";
import TrackedLink from "@/app/components/TrackedLink";
import {
  DECISION_TYPE_LABELS,
  formatDecisionOutcomeLabel,
  formatDecisionHistoryDate,
  FREE_DECISION_HISTORY_LIMIT,
  loadDecisionHistory,
  OUTCOME_LABELS
} from "@/app/lib/decisionHistory";
import { buildDecisionReplayPath } from "@/app/lib/decisionReplay";
import { EMPTY_DECISION_PROFILE } from "@/src/lib/decisionProfile";
import {
  buildOutcomeReminderCandidates,
  limitOutcomeReminderCandidates
} from "@/src/lib/outcomeReminder";
import { getViewerFromCookies } from "@/app/lib/viewer";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  const viewer = await getViewerFromCookies();
  const { entries, stats, profile, error } = viewer
    ? await loadDecisionHistory(viewer.userId)
    : await Promise.resolve({
        entries: [],
        stats: {
          totalDecisions: 0,
          resolvedCount: 0,
          unresolvedCount: 0,
          successCount: 0,
          regretCount: 0,
          neutralCount: 0,
          successRate: 0
        },
        profile: EMPTY_DECISION_PROFILE,
        error: null
      });
  const visibleEntries = viewer?.isPaid ? entries : entries.slice(0, FREE_DECISION_HISTORY_LIMIT);
  const remainingSlots = viewer?.isPaid ? null : Math.max(FREE_DECISION_HISTORY_LIMIT - stats.totalDecisions, 0);
  const allOutcomeReminders = buildOutcomeReminderCandidates(entries);
  const visibleOutcomeReminders = limitOutcomeReminderCandidates(allOutcomeReminders, viewer?.isPaid ?? false);
  const hiddenOutcomeReminderCount = Math.max(allOutcomeReminders.length - visibleOutcomeReminders.length, 0);

  return (
    <main className={styles.page}>
      <AnalyticsPageView page="/history" pageEventName="history_view" />
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>Decision History</p>
          <h1>採用した判断と、その結果をあとで学習できる状態にする。</h1>
          <p className={styles.lead}>
            どの judgment card を使ったかを残し、あとから満足・後悔・普通で結果を更新できます。自分の判断傾向を蓄積して、次回の選び方に戻せます。
          </p>

          <div className={styles.statsGrid}>
            <article className={styles.statCard}>
              <span className={styles.statLabel}>成功率</span>
              <strong className={styles.statValue}>{stats.successRate}%</strong>
            </article>
            <article className={styles.statCard}>
              <span className={styles.statLabel}>判断数</span>
              <strong className={styles.statValue}>{stats.totalDecisions}</strong>
            </article>
            <article className={styles.statCard}>
              <span className={styles.statLabel}>満足</span>
              <strong className={styles.statValue}>{stats.successCount}</strong>
            </article>
            <article className={styles.statCard}>
              <span className={styles.statLabel}>後悔</span>
              <strong className={styles.statValue}>{stats.regretCount}</strong>
            </article>
            <article className={styles.statCard}>
              <span className={styles.statLabel}>未記録</span>
              <strong className={styles.statValue}>{stats.unresolvedCount}</strong>
            </article>
          </div>

          <p className={styles.limitText}>
            {viewer?.isPaid
              ? "有料会員は履歴を無制限で保存できます。"
              : `無料版は履歴を最大${FREE_DECISION_HISTORY_LIMIT}件まで保存できます。残り ${remainingSlots ?? FREE_DECISION_HISTORY_LIMIT} 件です。`}
          </p>
        </div>

        <MemberControls
          viewer={viewer}
          title="Decision Memory"
          copy="保存した判断に outcome を残すことで、自分に合う判断の精度を継続的に上げていきます。"
          analyticsSource="/history"
        />
      </section>

      {!viewer ? (
        <section className={styles.noticePanel}>
          <h2>履歴を使うにはログインが必要です</h2>
          <p>判断カードで「この判断を使う」を押すと履歴に保存されます。ログイン後、この画面で結果を更新できます。</p>
          <TrackedLink
            href="/account"
            className={styles.primaryLink}
            eventName="subscribe_cta_click"
            eventProperties={{
              page: "/history",
              source: "history_login_notice"
            }}
          >
            Account でログイン
          </TrackedLink>
        </section>
      ) : null}

      {!viewer?.isPaid ? (
        <section className={styles.noticePanel}>
          <h2>free は10件、paid は無制限</h2>
          <p>保存件数が上限に達すると、新しい判断は保存できません。継続的に personal learning を使う場合は paid に切り替えてください。</p>
          <TrackedLink
            href="/account"
            className={styles.secondaryLink}
            eventName="subscribe_cta_click"
            eventProperties={{
              page: "/history",
              source: "history_limit_notice"
            }}
          >
            プランを見る
          </TrackedLink>
        </section>
      ) : null}

      {error ? <p className={styles.errorText}>履歴の読み込みに失敗しました: {error}</p> : null}

      {viewer && visibleOutcomeReminders.length > 0 ? (
        <OutcomeReminderSection
          reminders={visibleOutcomeReminders}
          hiddenCount={hiddenOutcomeReminderCount}
          isPaid={viewer.isPaid}
          page="/history"
        />
      ) : null}

      {viewer ? (
        <section className={styles.section}>
          <div className={styles.sectionHeading}>
            <div>
              <p className={styles.sectionEyebrow}>Personal Decision Profile</p>
              <h2>履歴から見える、あなたの判断傾向</h2>
              <p className={styles.sectionLead}>
                保存した decision history を集計して、どの frame / genre / outcome に偏りがあるかを可視化します。
              </p>
            </div>
            <span className={styles.sectionCount}>{profile.totalDecisions}件</span>
          </div>

          <div className={styles.profileOverviewGrid}>
            <article className={styles.profilePanel}>
              <h3>基本サマリー</h3>
              <div className={styles.profileStatGrid}>
                <div>
                  <dt>総判断数</dt>
                  <dd>{profile.totalDecisions}</dd>
                </div>
                <div>
                  <dt>成功率</dt>
                  <dd>{stats.successRate}%</dd>
                </div>
                <div>
                  <dt>満足しやすい frame</dt>
                  <dd>{profile.bestFrameType ? `${profile.bestFrameType.label} (${profile.bestFrameType.successRate}%)` : "データ待ち"}</dd>
                </div>
                <div>
                  <dt>後悔しやすい frame</dt>
                  <dd>{profile.riskyFrameType ? `${profile.riskyFrameType.label} (${profile.riskyFrameType.regretRate}%)` : "データ待ち"}</dd>
                </div>
              </div>
            </article>

            <article className={styles.profilePanel}>
              <h3>判断と outcome の比率</h3>
              <div className={styles.ratioGroup}>
                <p className={styles.ratioLabel}>Decision Type</p>
                <div className={styles.ratioRow}>
                  {(["use_now", "watch", "skip"] as const).map((decisionType) => (
                    <div key={decisionType} className={styles.ratioChip}>
                      <span>{DECISION_TYPE_LABELS[decisionType]}</span>
                      <strong>{profile.decisionRatios[decisionType].percentage}%</strong>
                    </div>
                  ))}
                </div>
              </div>
              <div className={styles.ratioGroup}>
                <p className={styles.ratioLabel}>Outcome</p>
                <div className={styles.ratioRow}>
                  {(["success", "regret", "neutral"] as const).map((outcome) => (
                    <div key={outcome} className={styles.ratioChip}>
                      <span>{OUTCOME_LABELS[outcome]}</span>
                      <strong>{profile.outcomeRatios[outcome].percentage}%</strong>
                    </div>
                  ))}
                </div>
              </div>
            </article>
          </div>

          <div className={styles.profileColumns}>
            <article className={styles.profilePanel}>
              <h3>よく使うジャンル</h3>
              {profile.topGenres.length === 0 ? (
                <p className={styles.profileEmpty}>まだジャンル傾向はありません。</p>
              ) : (
                <ul className={styles.profileList}>
                  {profile.topGenres.map((genre) => (
                    <li key={genre.key}>
                      <span>{genre.label}</span>
                      <strong>{genre.count}件</strong>
                    </li>
                  ))}
                </ul>
              )}
            </article>

            <article className={styles.profilePanel}>
              <h3>後悔しやすいジャンル / frame</h3>
              <ul className={styles.profileList}>
                <li>
                  <span>ジャンル</span>
                  <strong>
                    {profile.regretGenres[0]
                      ? `${profile.regretGenres[0].label} (${profile.regretGenres[0].regretCount}/${profile.regretGenres[0].count})`
                      : "データ待ち"}
                  </strong>
                </li>
                <li>
                  <span>frame</span>
                  <strong>
                    {profile.riskyFrameType
                      ? `${profile.riskyFrameType.label} (${profile.riskyFrameType.regretCount}/${profile.riskyFrameType.count})`
                      : "データ待ち"}
                  </strong>
                </li>
                <li>
                  <span>満足 frame</span>
                  <strong>
                    {profile.bestFrameType
                      ? `${profile.bestFrameType.label} (${profile.bestFrameType.successCount}/${profile.bestFrameType.count})`
                      : "データ待ち"}
                  </strong>
                </li>
              </ul>
            </article>

            <article className={styles.profilePanel}>
              <h3>あなたの傾向</h3>
              {profile.insights.length === 0 ? (
                <p className={styles.profileEmpty}>
                  履歴が5件以上たまると、frame / genre / outcome の傾向 insight をここに表示します。
                </p>
              ) : (
                <ul className={styles.insightList}>
                  {profile.insights.map((insight) => (
                    <li
                      key={insight.key}
                      className={`${styles.insightItem} ${styles[`insight_${insight.tone}`]}`.trim()}
                    >
                      <strong>{insight.title}</strong>
                      <p>{insight.body}</p>
                    </li>
                  ))}
                </ul>
              )}
            </article>
          </div>

          <p className={styles.profileFootnote}>
            {viewer.isPaid
              ? "paid は保存上限なしで profile を育てられ、judgment card 上にも personal hint を返せます。"
              : `free は最大${FREE_DECISION_HISTORY_LIMIT}件までで profile を更新します。paid にすると履歴上限なし + judgment card の personal hint を開放します。`}
          </p>
        </section>
      ) : null}

      <section className={styles.section}>
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.sectionEyebrow}>Past Decisions</p>
            <h2>過去の判断</h2>
          </div>
          <span className={styles.sectionCount}>{visibleEntries.length}件</span>
        </div>

        {visibleEntries.length === 0 ? (
          <p className={styles.emptyText}>
            まだ履歴はありません。`/decisions` またはエピソード詳細から判断を保存すると、ここに積み上がります。
          </p>
        ) : (
          <div className={styles.historyList}>
            {visibleEntries.map((entry) => (
              <article key={entry.id} id={`decision-${entry.id}`} className={styles.historyCard}>
                <div className={styles.historyHeader}>
                  <div>
                    <p className={styles.cardEyebrow}>{entry.frame_type ?? "Frame 未設定"}</p>
                    <h3>{entry.topic_title}</h3>
                  </div>
                  <span className={`${styles.badge} ${styles[`badge_${entry.decision_type}`]}`.trim()}>
                    {DECISION_TYPE_LABELS[entry.decision_type]}
                  </span>
                </div>

                <dl className={styles.metaGrid}>
                  <div>
                    <dt>Topic</dt>
                    <dd>{entry.topic_title}</dd>
                  </div>
                  <div>
                    <dt>Frame</dt>
                    <dd>{entry.frame_type ?? "-"}</dd>
                  </div>
                  <div>
                    <dt>Date</dt>
                    <dd>{formatDecisionHistoryDate(entry.created_at)}</dd>
                  </div>
                  <div>
                    <dt>Episode</dt>
                    <dd>{entry.episode_title ?? "Untitled episode"}</dd>
                  </div>
                </dl>

                <div className={styles.outcomeRow}>
                  <div>
                    <p className={styles.outcomeLabel}>結果</p>
                    <p className={styles.outcomeValue}>{formatDecisionOutcomeLabel(entry.outcome)}</p>
                  </div>
                  <DecisionOutcomeSelect
                    decisionId={entry.id}
                    initialOutcome={entry.outcome}
                    page="/history"
                    episodeId={entry.episode_id}
                    judgmentCardId={entry.judgment_card_id}
                    genre={entry.genre}
                    frameType={entry.frame_type}
                    judgmentType={entry.decision_type}
                  />
                </div>
                <div className={styles.cardFooter}>
                  <TrackedLink
                    href={buildDecisionReplayPath(entry.id)}
                    className={styles.replayLink}
                    eventName="decision_replay_from_history_click"
                    eventProperties={{
                      page: "/history",
                      source: "history_list_card",
                      decision_id: entry.id,
                      episode_id: entry.episode_id,
                      judgment_card_id: entry.judgment_card_id,
                      genre: entry.genre ?? undefined,
                      frame_type: entry.frame_type ?? undefined,
                      saved_decision_type: entry.decision_type,
                      outcome: entry.outcome
                    }}
                  >
                    Replayを見る
                  </TrackedLink>
                </div>
                <RemoveDecisionButton
                  decisionId={entry.id}
                  page="/history"
                  episodeId={entry.episode_id}
                  judgmentCardId={entry.judgment_card_id}
                  genre={entry.genre}
                  frameType={entry.frame_type}
                  judgmentType={entry.decision_type}
                />
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
