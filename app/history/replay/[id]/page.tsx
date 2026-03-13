import Link from "next/link";
import { notFound } from "next/navigation";
import AnalyticsEventOnRender from "@/app/components/AnalyticsEventOnRender";
import AnalyticsPageView from "@/app/components/AnalyticsPageView";
import MemberControls from "@/app/components/MemberControls";
import TrackedLink from "@/app/components/TrackedLink";
import { DECISION_TYPE_LABELS, OUTCOME_LABELS } from "@/app/lib/decisionHistory";
import {
  buildDecisionReplayPath,
  buildDecisionReplayView,
  formatDecisionReplayDateTime,
  loadDecisionReplay
} from "@/app/lib/decisionReplay";
import { getViewerFromCookies } from "@/app/lib/viewer";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

export default async function DecisionReplayPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const viewer = await getViewerFromCookies();
  const pagePath = buildDecisionReplayPath(id);
  const replayState = viewer
    ? await loadDecisionReplay(viewer.userId, id)
    : await Promise.resolve({
        replay: null,
        profile: null,
        insights: [],
        error: null
      });
  const replay = replayState.replay;

  if (viewer && !replay && !replayState.error) {
    notFound();
  }

  const visibleReplay = replay ? buildDecisionReplayView(replay, viewer?.isPaid ?? false) : null;

  return (
    <main className={styles.page}>
      <AnalyticsPageView
        page={pagePath}
        pageEventName="decision_replay_view"
        extraProperties={
          replay
            ? {
                decision_id: replay.id,
                episode_id: replay.episode_id,
                judgment_card_id: replay.judgment_card_id,
                genre: replay.genre ?? undefined,
                frame_type: replay.frame_type ?? undefined,
                judgment_type: replay.judgment_type,
                saved_decision_type: replay.decision_type,
                outcome: replay.outcome
              }
            : undefined
        }
      />

      <div className={styles.backRow}>
        <Link href="/history">History</Link>
        {replay?.episode_id ? <Link href={`/episodes/${replay.episode_id}`}>Episode</Link> : null}
      </div>

      {!viewer ? (
        <section className={styles.noticePanel}>
          <p className={styles.eyebrow}>Decision Replay</p>
          <h1>Replay を見るにはログインが必要です</h1>
          <p className={styles.bodyText}>
            保存済みの判断だけを時系列で振り返れるようにしているため、この画面はログイン後に開放されます。
          </p>
          <TrackedLink
            href="/account"
            className={styles.primaryLink}
            eventName="subscribe_cta_click"
            eventProperties={{
              page: pagePath,
              source: "decision_replay_login_notice"
            }}
          >
            Account でログイン
          </TrackedLink>
        </section>
      ) : null}

      {replayState.error ? <p className={styles.errorText}>replay の読み込みに失敗しました: {replayState.error}</p> : null}

      {visibleReplay && replay ? (
        <>
          <section className={styles.hero}>
            <div className={styles.heroCopy}>
              <p className={styles.eyebrow}>Decision Replay</p>
              <h1>{replay.topic_title}</h1>
              <p className={styles.lead}>
                当時の judgment card と、あとから記録した outcome を並べて振り返ります。過去の判断を profile と
                recommendation に戻すための replay です。
              </p>

              <div className={styles.badgeRow}>
                <span className={`${styles.badge} ${styles[`badge_${replay.judgment_type}`]}`.trim()}>
                  Card: {DECISION_TYPE_LABELS[replay.judgment_type]}
                </span>
                <span className={`${styles.badge} ${styles[`badge_${replay.decision_type}`]}`.trim()}>
                  Saved: {DECISION_TYPE_LABELS[replay.decision_type]}
                </span>
                <span className={styles.outcomeBadge}>{OUTCOME_LABELS[replay.outcome]}</span>
              </div>
            </div>

            <MemberControls
              viewer={viewer}
              title="Replay Access"
              copy="free は replay preview まで、paid は当時の判断理由と insight まで振り返れます。"
              analyticsSource={pagePath}
            />
          </section>

          <section className={styles.section}>
            <div className={styles.sectionHeading}>
              <div>
                <p className={styles.sectionEyebrow}>Section 1</p>
                <h2>判断概要</h2>
              </div>
            </div>

            <dl className={styles.summaryGrid}>
              <div>
                <dt>Topic</dt>
                <dd>{replay.topic_title}</dd>
              </div>
              <div>
                <dt>Genre</dt>
                <dd>{replay.genre ?? "-"}</dd>
              </div>
              <div>
                <dt>Frame</dt>
                <dd>{replay.frame_type ?? "-"}</dd>
              </div>
              <div>
                <dt>Judgment Type</dt>
                <dd>{DECISION_TYPE_LABELS[replay.judgment_type]}</dd>
              </div>
              <div>
                <dt>判断した日</dt>
                <dd>{formatDecisionReplayDateTime(replay.created_at)}</dd>
              </div>
              <div>
                <dt>Outcome 更新日</dt>
                <dd>{formatDecisionReplayDateTime(replay.outcome_updated_at)}</dd>
              </div>
            </dl>
          </section>

          <section className={styles.section}>
            <div className={styles.sectionHeading}>
              <div>
                <p className={styles.sectionEyebrow}>Section 2</p>
                <h2>当時の判断内容</h2>
              </div>
            </div>

            <div className={styles.detailColumns}>
              <article className={styles.panel}>
                <p className={styles.cardLabel}>Judgment Summary</p>
                <p className={styles.summaryText}>{replay.judgment_summary}</p>
              </article>

              <article className={styles.panel}>
                <p className={styles.cardLabel}>なぜそう判断だったか</p>
                {viewer?.isPaid ? (
                  <div className={styles.reasonStack}>
                    <div className={styles.detailGroup}>
                      <span>次の行動</span>
                      <strong>{visibleReplay.action_text ?? "記録なし"}</strong>
                    </div>
                    <div className={styles.detailGroup}>
                      <span>期限</span>
                      <strong>{formatDecisionReplayDateTime(visibleReplay.deadline_at)}</strong>
                    </div>
                    {visibleReplay.watch_points.length > 0 ? (
                      <ul className={styles.list}>
                        {visibleReplay.watch_points.map((point) => (
                          <li key={point}>{point}</li>
                        ))}
                      </ul>
                    ) : null}
                    {visibleReplay.threshold_highlights.length > 0 ? (
                      <ul className={styles.list}>
                        {visibleReplay.threshold_highlights.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    ) : null}
                    {!visibleReplay.action_text &&
                    !visibleReplay.deadline_at &&
                    visibleReplay.watch_points.length === 0 &&
                    visibleReplay.threshold_highlights.length === 0 ? (
                      <p className={styles.mutedText}>当時の判断理由として保存された追加情報はまだありません。</p>
                    ) : null}
                  </div>
                ) : (
                  <div className={styles.lockedPanel}>
                    <strong>paid で full replay を開放</strong>
                    <p>当時の行動指針、deadline、watch points、threshold を並べて振り返れます。</p>
                    <TrackedLink
                      href="/account"
                      className={styles.secondaryLink}
                      eventName="subscribe_cta_click"
                      eventProperties={{
                        page: pagePath,
                        source: "decision_replay_locked_reason",
                        decision_id: replay.id,
                        judgment_card_id: replay.judgment_card_id
                      }}
                    >
                      full replay を開く
                    </TrackedLink>
                  </div>
                )}
              </article>
            </div>
          </section>

          <section className={styles.section}>
            <div className={styles.sectionHeading}>
              <div>
                <p className={styles.sectionEyebrow}>Section 3</p>
                <h2>あなたの行動</h2>
              </div>
            </div>

            <div className={styles.compareGrid}>
              <article className={styles.compareCard}>
                <p className={styles.cardLabel}>当時の判断</p>
                <strong>{DECISION_TYPE_LABELS[replay.judgment_type]}</strong>
                <p className={styles.bodyText}>{replay.judgment_summary}</p>
                <dl className={styles.metaList}>
                  <div>
                    <dt>Card Recommendation</dt>
                    <dd>{DECISION_TYPE_LABELS[replay.judgment_type]}</dd>
                  </div>
                  <div>
                    <dt>判断日時</dt>
                    <dd>{formatDecisionReplayDateTime(replay.created_at)}</dd>
                  </div>
                </dl>
              </article>

              <article className={styles.compareCard}>
                <p className={styles.cardLabel}>実際の結果</p>
                <strong>{OUTCOME_LABELS[replay.outcome]}</strong>
                <p className={styles.bodyText}>保存した判断: {DECISION_TYPE_LABELS[replay.decision_type]}</p>
                <dl className={styles.metaList}>
                  <div>
                    <dt>Outcome</dt>
                    <dd>{OUTCOME_LABELS[replay.outcome]}</dd>
                  </div>
                  <div>
                    <dt>更新日時</dt>
                    <dd>{formatDecisionReplayDateTime(replay.outcome_updated_at)}</dd>
                  </div>
                </dl>
              </article>
            </div>
          </section>

          <section className={styles.section}>
            <div className={styles.sectionHeading}>
              <div>
                <p className={styles.sectionEyebrow}>Section 4</p>
                <h2>Replay Insight</h2>
              </div>
            </div>

            {viewer?.isPaid ? (
              <>
                {replayState.insights.length > 0 ? (
                  <AnalyticsEventOnRender
                    eventName="decision_replay_insight_impression"
                    properties={{
                      page: pagePath,
                      source: "decision_replay_insight_section",
                      decision_id: replay.id,
                      judgment_card_id: replay.judgment_card_id,
                      outcome: replay.outcome,
                      insight_count: replayState.insights.length
                    }}
                  />
                ) : null}
                {replayState.insights.length > 0 ? (
                  <ul className={styles.insightList}>
                    {replayState.insights.map((insight) => (
                      <li key={insight.key} className={`${styles.insightItem} ${styles[`insight_${insight.tone}`]}`.trim()}>
                        <strong>{insight.title}</strong>
                        <p>{insight.body}</p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className={styles.mutedText}>まだ replay insight はありません。履歴が増えるほど、より具体的な学びを返しやすくなります。</p>
                )}
              </>
            ) : (
              <div className={styles.lockedPanel}>
                <strong>paid で insight を開放</strong>
                <p>replay を profile と recommendation に返す学びは、有料会員でフル表示されます。</p>
              </div>
            )}
          </section>
        </>
      ) : null}
    </main>
  );
}
