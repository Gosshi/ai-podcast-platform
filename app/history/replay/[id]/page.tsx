import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import AnalyticsPageView from "@/app/components/AnalyticsPageView";
import MemberControls from "@/app/components/MemberControls";
import TrackedLink from "@/app/components/TrackedLink";
import {
  buildDecisionReplayView,
  formatDecisionReplayDateTime,
  loadDecisionReplay
} from "@/app/lib/decisionReplay";
import { buildLoginPath } from "@/app/lib/onboarding";
import { formatFrameTypeLabel, formatGenreLabel } from "@/app/lib/uiText";
import { getViewerFromCookies } from "@/app/lib/viewer";
import { DECISION_TYPE_LABELS, formatDecisionOutcomeLabel } from "@/app/lib/decisionHistory";
import styles from "@/app/member-surface.module.css";

export const metadata: Metadata = {
  title: "判断の学び直し",
  description: "当時の判断、結果、学びを見直して次の意思決定に活かします。"
};

export const dynamic = "force-dynamic";

export default async function DecisionReplayPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const viewer = await getViewerFromCookies();
  const { id } = await params;

  if (!viewer) {
    redirect(buildLoginPath(`/history/replay/${id}`));
  }

  const { replay, insights, error } = await loadDecisionReplay(viewer.userId, id);
  const visibleReplay = replay ? buildDecisionReplayView(replay, viewer.isPaid) : null;
  const visibleInsights = viewer.isPaid ? insights : [];

  return (
    <main className={styles.page}>
      <AnalyticsPageView page="/history/replay" pageEventName="decision_replay_view" />

      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>Replay</p>
          <h1>{visibleReplay ? visibleReplay.topic_title : "判断の学び直し"}</h1>
          <p className={styles.lead}>
            当時の判断理由と結果を並べて見直し、次の意思決定で同じ迷いを減らします。
          </p>

          {visibleReplay ? (
            <div className={styles.statsGrid}>
              <article className={styles.statCard}>
                <span className={styles.statLabel}>当時の判断</span>
                <strong className={styles.statValue}>{DECISION_TYPE_LABELS[visibleReplay.decision_type]}</strong>
              </article>
              <article className={styles.statCard}>
                <span className={styles.statLabel}>結果</span>
                <strong className={styles.statValue}>{formatDecisionOutcomeLabel(visibleReplay.outcome)}</strong>
              </article>
              <article className={styles.statCard}>
                <span className={styles.statLabel}>カテゴリ</span>
                <strong className={styles.statValue}>{formatGenreLabel(visibleReplay.genre, "-")}</strong>
              </article>
            </div>
          ) : null}
        </div>

        <MemberControls
          viewer={viewer}
          title="プラン"
          copy="振り返りの学びを積み上げると、判断の精度が上がっていきます。"
          analyticsSource="/history/replay"
          variant="compact"
        />
      </section>

      {error ? <p className={styles.errorText}>学びの読み込みに失敗しました。時間をおいて再度お試しください。</p> : null}

      {!visibleReplay && !error ? (
        <section className={styles.emptyState}>
          <h2>この学びはまだ作られていません</h2>
          <p className={styles.sublead}>履歴に戻って別の判断から見直してください。</p>
        </section>
      ) : null}

      {visibleReplay ? (
        <>
          <section className={styles.section}>
            <h2>判断の内容</h2>
            <div className={styles.card}>
              <dl className={styles.definitionList}>
                <div className={styles.definitionRow}>
                  <dt>エピソード</dt>
                  <dd>{visibleReplay.episode_title ?? "不明"}</dd>
                </div>
                <div className={styles.definitionRow}>
                  <dt>比較のしかた</dt>
                  <dd>{formatFrameTypeLabel(visibleReplay.frame_type, "-")}</dd>
                </div>
                <div className={styles.definitionRow}>
                  <dt>判断概要</dt>
                  <dd>{visibleReplay.judgment_summary}</dd>
                </div>
                <div className={styles.definitionRow}>
                  <dt>記録日時</dt>
                  <dd>{formatDecisionReplayDateTime(visibleReplay.created_at)}</dd>
                </div>
                {visibleReplay.outcome_updated_at ? (
                  <div className={styles.definitionRow}>
                    <dt>結果更新</dt>
                    <dd>{formatDecisionReplayDateTime(visibleReplay.outcome_updated_at)}</dd>
                  </div>
                ) : null}
                {visibleReplay.action_text ? (
                  <div className={styles.definitionRow}>
                    <dt>次の一手</dt>
                    <dd>{visibleReplay.action_text}</dd>
                  </div>
                ) : null}
                {visibleReplay.deadline_at ? (
                  <div className={styles.definitionRow}>
                    <dt>見直し期限</dt>
                    <dd>{formatDecisionReplayDateTime(visibleReplay.deadline_at)}</dd>
                  </div>
                ) : null}
              </dl>
            </div>
          </section>

          {visibleReplay.watch_points.length > 0 || visibleReplay.threshold_highlights.length > 0 ? (
            <section className={styles.section}>
              <h2>判断のメモ</h2>
              {visibleReplay.watch_points.length > 0 ? (
                <div className={styles.card}>
                  <h3>様子を見るポイント</h3>
                  <ul className={styles.list}>
                    {visibleReplay.watch_points.map((point) => (
                      <li key={point}>{point}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {visibleReplay.threshold_highlights.length > 0 ? (
                <div className={styles.card}>
                  <h3>比較に使った基準</h3>
                  <ul className={styles.list}>
                    {visibleReplay.threshold_highlights.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </section>
          ) : null}

          <section className={styles.section}>
            <h2>{viewer.isPaid ? "今回の学び" : "今回の学びは有料版で確認できます"}</h2>
            {viewer.isPaid ? (
              visibleInsights.length > 0 ? (
                visibleInsights.map((insight) => (
                  <div key={insight.key} className={styles.card}>
                    <h3>{insight.title}</h3>
                    <p>{insight.body}</p>
                  </div>
                ))
              ) : (
                <div className={styles.card}>
                  <p>もう少し履歴が集まると、この判断からの学びが表示されます。</p>
                </div>
              )
            ) : (
              <div className={styles.notice}>
                <p>
                  有料版では、当時の行動提案・見直し期限・比較基準・振り返りインサイトまで確認できます。
                </p>
                <TrackedLink
                  href="/account"
                  className={styles.secondaryLink}
                  eventName="subscribe_cta_click"
                  eventProperties={{
                    page: "/history/replay",
                    source: "decision_replay_paywall"
                  }}
                >
                  有料版を確認する
                </TrackedLink>
              </div>
            )}
          </section>

          <section className={styles.section}>
            <div className={styles.ctaRow}>
              <Link href="/history" className={styles.primaryLink}>
                履歴に戻る
              </Link>
              {visibleReplay.episode_id ? (
                <TrackedLink
                  href={`/decisions/${visibleReplay.episode_id}`}
                  className={styles.secondaryLink}
                  eventName="decision_replay_from_history_click"
                  eventProperties={{
                    page: "/history/replay",
                    source: "decision_replay_episode_link",
                    decision_id: visibleReplay.id,
                    episode_id: visibleReplay.episode_id
                  }}
                >
                  元のエピソードを見る
                </TrackedLink>
              ) : null}
            </div>
          </section>
        </>
      ) : null}
    </main>
  );
}
