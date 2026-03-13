import Link from "next/link";
import DecisionOutcomeSelect from "@/app/components/DecisionOutcomeSelect";
import MemberControls from "@/app/components/MemberControls";
import {
  DECISION_TYPE_LABELS,
  formatDecisionHistoryDate,
  FREE_DECISION_HISTORY_LIMIT,
  loadDecisionHistory,
  OUTCOME_LABELS
} from "@/app/lib/decisionHistory";
import { getViewerFromCookies } from "@/app/lib/viewer";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  const viewer = await getViewerFromCookies();
  const { entries, stats, error } = viewer
    ? await loadDecisionHistory(viewer.userId)
    : await Promise.resolve({
        entries: [],
        stats: {
          totalDecisions: 0,
          successCount: 0,
          regretCount: 0,
          neutralCount: 0,
          successRate: 0
        },
        error: null
      });
  const visibleEntries = viewer?.isPaid ? entries : entries.slice(0, FREE_DECISION_HISTORY_LIMIT);
  const remainingSlots = viewer?.isPaid ? null : Math.max(FREE_DECISION_HISTORY_LIMIT - stats.totalDecisions, 0);

  return (
    <main className={styles.page}>
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
        />
      </section>

      {!viewer ? (
        <section className={styles.noticePanel}>
          <h2>履歴を使うにはログインが必要です</h2>
          <p>判断カードで「この判断を使う」を押すと履歴に保存されます。ログイン後、この画面で結果を更新できます。</p>
          <Link href="/account" className={styles.primaryLink}>
            Account でログイン
          </Link>
        </section>
      ) : null}

      {!viewer?.isPaid ? (
        <section className={styles.noticePanel}>
          <h2>free は10件、paid は無制限</h2>
          <p>保存件数が上限に達すると、新しい判断は保存できません。継続的に personal learning を使う場合は paid に切り替えてください。</p>
          <Link href="/account" className={styles.secondaryLink}>
            プランを見る
          </Link>
        </section>
      ) : null}

      {error ? <p className={styles.errorText}>履歴の読み込みに失敗しました: {error}</p> : null}

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
              <article key={entry.id} className={styles.historyCard}>
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
                    <p className={styles.outcomeValue}>{OUTCOME_LABELS[entry.outcome]}</p>
                  </div>
                  <DecisionOutcomeSelect decisionId={entry.id} initialOutcome={entry.outcome} />
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
