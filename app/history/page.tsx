import type { Metadata } from "next";
import { redirect } from "next/navigation";
import AnalyticsPageView from "@/app/components/AnalyticsPageView";
import DecisionOutcomeSelect from "@/app/components/DecisionOutcomeSelect";

export const metadata: Metadata = {
  title: "判断の履歴",
  description: "過去に記録した判断の一覧と結果。成功率やジャンル傾向を振り返って、判断の精度を高めよう。"
};
import MemberControls from "@/app/components/MemberControls";
import OutcomeReminderSection from "@/app/components/OutcomeReminderSection";
import RemoveDecisionButton from "@/app/components/RemoveDecisionButton";
import TrackedLink from "@/app/components/TrackedLink";
import {
  buildDecisionReplayPath,
} from "@/app/lib/decisionReplay";
import {
  DECISION_TYPE_LABELS,
  formatDecisionOutcomeLabel,
  formatDecisionHistoryDate,
  FREE_DECISION_HISTORY_LIMIT,
  loadDecisionHistory,
  OUTCOME_LABELS
} from "@/app/lib/decisionHistory";
import { formatEpisodeTitle, formatFrameTypeLabel, formatGenreLabel, formatTopicTitle } from "@/app/lib/uiText";
import { buildLoginPath } from "@/app/lib/onboarding";
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
  if (!viewer) {
    redirect(buildLoginPath("/history"));
  }

  const { entries, stats, profile, error } = await loadDecisionHistory(viewer.userId);
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
          <p className={styles.eyebrow}>履歴</p>
          <h1>行動の記録と振り返り</h1>

          <div className={styles.statsGrid}>
            <article className={styles.statCard}>
              <span className={styles.statLabel}>満足率</span>
              <strong className={styles.statValue}>{stats.successRate}%</strong>
            </article>
            <article className={styles.statCard}>
              <span className={styles.statLabel}>実行数</span>
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
          title="プラン"
          copy="アクションの結果を記録して傾向を把握できます。"
          analyticsSource="/history"
          variant="compact"
        />
      </section>

      {!viewer.isPaid ? (
        <section className={styles.noticePanel}>
          <h2>無料版は10件まで、有料版は上限なしです</h2>
          <p>有料版では履歴分析まで含めて見直しを続けられます。継続して振り返る場合は有料版に切り替えてください。</p>
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

      {error ? <p className={styles.errorText}>履歴の読み込みに失敗しました。時間をおいて再度お試しください。</p> : null}

      {visibleOutcomeReminders.length > 0 ? (
        <OutcomeReminderSection
          reminders={visibleOutcomeReminders}
          hiddenCount={hiddenOutcomeReminderCount}
          isPaid={viewer.isPaid}
          page="/history"
        />
      ) : null}

      <section className={styles.section}>
          <div className={styles.sectionHeading}>
            <div>
              <p className={styles.sectionEyebrow}>あなたの傾向</p>
              <h2>行動傾向の分析</h2>
            </div>
            <span className={styles.sectionCount}>{profile.totalDecisions}件</span>
          </div>

          <div className={styles.profileOverviewGrid}>
            <article className={styles.profilePanel}>
              <h3>基本サマリー</h3>
              <div className={styles.profileStatGrid}>
                <div>
                  <dt>総アクション数</dt>
                  <dd>{profile.totalDecisions}</dd>
                </div>
                <div>
                  <dt>成功率</dt>
                  <dd>{stats.successRate}%</dd>
                </div>
                <div>
                  <dt>相性のよい比較のしかた</dt>
                  <dd>{profile.bestFrameType ? `${profile.bestFrameType.label} (${profile.bestFrameType.successRate}%)` : "データ待ち"}</dd>
                </div>
                <div>
                  <dt>注意したい比較のしかた</dt>
                  <dd>{profile.riskyFrameType ? `${profile.riskyFrameType.label} (${profile.riskyFrameType.regretRate}%)` : "データ待ち"}</dd>
                </div>
              </div>
            </article>

            <article className={styles.profilePanel}>
              <h3>採用カードと結果の比率</h3>
              <div className={styles.ratioGroup}>
                <p className={styles.ratioLabel}>採用したカードの推奨タイプ</p>
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
                <p className={styles.ratioLabel}>結果</p>
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
              <h3>注意したい傾向</h3>
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
                  <span>比較のしかた</span>
                  <strong>
                    {profile.riskyFrameType
                      ? `${profile.riskyFrameType.label} (${profile.riskyFrameType.regretCount}/${profile.riskyFrameType.count})`
                      : "データ待ち"}
                  </strong>
                </li>
                <li>
                  <span>相性のよい比較のしかた</span>
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
                  履歴が5件以上たまると、比較のしかたやカテゴリ、結果の傾向をここに表示します。
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
              ? "有料版では履歴上限なしで結果分析を続けられます。"
              : `無料版では最大${FREE_DECISION_HISTORY_LIMIT}件まで履歴を分析します。有料版で履歴上限なしになります。`}
          </p>
        </section>

      <section className={styles.section}>
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.sectionEyebrow}>履歴一覧</p>
            <h2>実行したアクション</h2>
          </div>
          <span className={styles.sectionCount}>{visibleEntries.length}件</span>
        </div>

        {visibleEntries.length === 0 ? (
          <p className={styles.emptyText}>
            まだ履歴はありません。エピソードの詳細画面からアクションを採用すると、ここに積み上がります。
          </p>
        ) : (
          <div className={styles.historyList}>
            {visibleEntries.map((entry) => (
              <article key={entry.id} id={`decision-${entry.id}`} className={styles.historyCard}>
                <div className={styles.historyHeader}>
                  <div>
                    <p className={styles.cardEyebrow}>
                      {entry.source === "ai_generated" ? "AI相談" : formatFrameTypeLabel(entry.frame_type)}
                    </p>
                    <h3>{formatTopicTitle(entry.topic_title)}</h3>
                  </div>
                  <div className={styles.badgeGroup}>
                    {entry.source === "ai_generated" ? (
                      <span className={`${styles.badge} ${styles.badge_ai}`.trim()}>AI生成</span>
                    ) : null}
                    <span className={`${styles.badge} ${styles[`badge_${entry.decision_type}`]}`.trim()}>
                      {DECISION_TYPE_LABELS[entry.decision_type]}
                    </span>
                  </div>
                </div>

                {entry.source === "ai_generated" && entry.input_text ? (
                  <p className={styles.inputTextPreview}>相談: {entry.input_text}</p>
                ) : null}

                <dl className={styles.metaGrid}>
                  <div>
                    <dt>トピック</dt>
                    <dd>{formatTopicTitle(entry.topic_title)}</dd>
                  </div>
                  <div>
                    <dt>カテゴリ</dt>
                    <dd>{formatGenreLabel(entry.genre, "-")}</dd>
                  </div>
                  <div>
                    <dt>{entry.source === "ai_generated" ? "相談日" : "採用日"}</dt>
                    <dd>{formatDecisionHistoryDate(entry.created_at)}</dd>
                  </div>
                  <div>
                    <dt>出典</dt>
                    <dd>{entry.source === "ai_generated" ? "AI相談" : formatEpisodeTitle(entry.episode_title)}</dd>
                  </div>
                </dl>

                <div className={styles.outcomeRow}>
                  <div>
                    <p className={styles.outcomeLabel}>結果</p>
                    <p className={styles.outcomeValue}>{formatDecisionOutcomeLabel(entry.outcome)}</p>
                  </div>
                  <DecisionOutcomeSelect
                    decisionId={entry.source === "ai_generated" ? entry.judgment_card_id : entry.id}
                    initialOutcome={entry.outcome}
                    page="/history"
                    episodeId={entry.episode_id}
                    judgmentCardId={entry.judgment_card_id}
                    genre={entry.genre}
                    frameType={entry.frame_type}
                    judgmentType={entry.decision_type}
                    apiBasePath={entry.source === "ai_generated" ? "/api/generate-card" : undefined}
                  />
                </div>
                {entry.source === "episode" ? (
                  <div className={styles.cardFooter}>
                    <TrackedLink
                      href={buildDecisionReplayPath(entry.id)}
                      className={styles.replayLink}
                      eventName="decision_replay_from_history_click"
                      eventProperties={{
                        page: "/history",
                        source: "history_list_card",
                        decision_id: entry.id,
                        destination: buildDecisionReplayPath(entry.id),
                        episode_id: entry.episode_id,
                        judgment_card_id: entry.judgment_card_id,
                        genre: entry.genre ?? undefined,
                        frame_type: entry.frame_type ?? undefined,
                        saved_decision_type: entry.decision_type,
                        outcome: entry.outcome
                      }}
                    >
                      学びを見る
                    </TrackedLink>
                  </div>
                ) : null}
                {entry.source === "episode" ? (
                  <RemoveDecisionButton
                    decisionId={entry.id}
                    page="/history"
                    episodeId={entry.episode_id}
                    judgmentCardId={entry.judgment_card_id}
                    genre={entry.genre}
                    frameType={entry.frame_type}
                    judgmentType={entry.decision_type}
                  />
                ) : null}
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
