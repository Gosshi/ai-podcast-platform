import Link from "next/link";
import { notFound } from "next/navigation";
import AnalyticsEventOnRender from "@/app/components/AnalyticsEventOnRender";
import AnalyticsPageView from "@/app/components/AnalyticsPageView";
import MemberControls from "@/app/components/MemberControls";
import TrackedLink from "@/app/components/TrackedLink";
import {
  DECISION_TYPE_LABELS,
  formatDecisionOutcomeLabel
} from "@/app/lib/decisionHistory";
import {
  buildDecisionReplayPath,
  buildDecisionReplayView,
  formatDecisionReplayDateTime,
  loadDecisionReplay
} from "@/app/lib/decisionReplay";
import { formatFrameTypeLabel, formatGenreLabel, formatTopicTitle } from "@/app/lib/uiText";
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
        <Link href="/history">履歴</Link>
        {replay?.episode_id ? <Link href={`/episodes/${replay.episode_id}`}>詳細</Link> : null}
      </div>

      {!viewer ? (
        <section className={styles.noticePanel}>
          <p className={styles.eyebrow}>振り返り</p>
          <h1>振り返りを見るにはログインが必要です</h1>
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
            アカウントでログイン
          </TrackedLink>
        </section>
      ) : null}

      {replayState.error ? <p className={styles.errorText}>振り返りの読み込みに失敗しました: {replayState.error}</p> : null}

      {visibleReplay && replay ? (
        <>
          <section className={styles.hero}>
            <div className={styles.heroCopy}>
              <p className={styles.eyebrow}>振り返り</p>
              <h1>{formatTopicTitle(replay.topic_title)}</h1>
              <p className={styles.lead}>
                当時の判断内容と、あとから記録した結果を並べて振り返ります。
              </p>

              <div className={styles.badgeRow}>
                <span className={`${styles.badge} ${styles[`badge_${replay.judgment_type}`]}`.trim()}>
                  おすすめ: {DECISION_TYPE_LABELS[replay.judgment_type]}
                </span>
                <span className={`${styles.badge} ${styles[`badge_${replay.decision_type}`]}`.trim()}>
                  保存時: {DECISION_TYPE_LABELS[replay.decision_type]}
                </span>
                <span className={styles.outcomeBadge}>{formatDecisionOutcomeLabel(replay.outcome)}</span>
              </div>
            </div>

            <MemberControls
              viewer={viewer}
              title="プラン"
              copy="無料版は振り返りの要点まで、有料版は当時の判断理由まで見返せます。"
              analyticsSource={pagePath}
              variant="compact"
            />
          </section>

          <section className={styles.section}>
            <div className={styles.sectionHeading}>
              <div>
                <p className={styles.sectionEyebrow}>概要</p>
                <h2>判断概要</h2>
              </div>
            </div>

            <dl className={styles.summaryGrid}>
              <div>
                <dt>タイトル</dt>
                <dd>{formatTopicTitle(replay.topic_title)}</dd>
              </div>
              <div>
                <dt>ジャンル</dt>
                <dd>{formatGenreLabel(replay.genre, "-")}</dd>
              </div>
              <div>
                <dt>比較のしかた</dt>
                <dd>{formatFrameTypeLabel(replay.frame_type, "-")}</dd>
              </div>
              <div>
                <dt>判断内容</dt>
                <dd>{DECISION_TYPE_LABELS[replay.judgment_type]}</dd>
              </div>
              <div>
                <dt>判断した日</dt>
                <dd>{formatDecisionReplayDateTime(replay.created_at)}</dd>
              </div>
              <div>
                <dt>結果の更新日</dt>
                <dd>{replay.outcome_updated_at ? formatDecisionReplayDateTime(replay.outcome_updated_at) : "未記録"}</dd>
              </div>
            </dl>
          </section>

          <section className={styles.section}>
            <div className={styles.sectionHeading}>
              <div>
                <p className={styles.sectionEyebrow}>判断内容</p>
                <h2>当時の判断内容</h2>
              </div>
            </div>

            <div className={styles.detailColumns}>
              <article className={styles.panel}>
                <p className={styles.cardLabel}>判断の説明</p>
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
                    <strong>有料版では当時の詳細まで振り返れます</strong>
                    <p>当時の行動指針、期限、見直しポイントをまとめて確認できます。</p>
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
                      詳しく見る
                    </TrackedLink>
                  </div>
                )}
              </article>
            </div>
          </section>

          <section className={styles.section}>
            <div className={styles.sectionHeading}>
              <div>
                <p className={styles.sectionEyebrow}>結果</p>
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
                    <dt>おすすめ</dt>
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
                <strong>{formatDecisionOutcomeLabel(replay.outcome)}</strong>
                <p className={styles.bodyText}>保存した判断: {DECISION_TYPE_LABELS[replay.decision_type]}</p>
                <dl className={styles.metaList}>
                  <div>
                    <dt>結果</dt>
                    <dd>{formatDecisionOutcomeLabel(replay.outcome)}</dd>
                  </div>
                  <div>
                    <dt>更新日時</dt>
                    <dd>{replay.outcome_updated_at ? formatDecisionReplayDateTime(replay.outcome_updated_at) : "未記録"}</dd>
                  </div>
                </dl>
              </article>
            </div>
          </section>

          <section className={styles.section}>
            <div className={styles.sectionHeading}>
              <div>
                <p className={styles.sectionEyebrow}>メモ</p>
                <h2>振り返りメモ</h2>
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
                  <p className={styles.mutedText}>まだ振り返りメモはありません。履歴が増えるほど、より具体的な学びを返しやすくなります。</p>
                )}
              </>
            ) : (
              <div className={styles.lockedPanel}>
                <strong>有料版では振り返りメモを詳しく表示します</strong>
                <p>過去の判断から学べる内容を、より詳しく確認できます。</p>
              </div>
            )}
          </section>
        </>
      ) : null}
    </main>
  );
}
