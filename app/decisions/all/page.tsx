import Link from "next/link";
import { redirect } from "next/navigation";
import AnalyticsEventOnRender from "@/app/components/AnalyticsEventOnRender";
import AnalyticsPageView from "@/app/components/AnalyticsPageView";
import JudgmentCardActions from "@/app/components/JudgmentCardActions";
import PremiumPreview from "@/app/components/PremiumPreview";
import TrackedLink from "@/app/components/TrackedLink";
import { loadDecisionDashboardCards } from "@/app/lib/decisions";
import { buildLoginPath } from "@/app/lib/onboarding";
import { formatGenreLabel, formatTopicTitle, JUDGMENT_TYPE_LABELS } from "@/app/lib/uiText";
import { getViewerFromCookies } from "@/app/lib/viewer";
import styles from "../page.module.css";

export const dynamic = "force-dynamic";

const formatDeadline = (value: string | null): string => {
  if (!value) return "期限未設定";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("ja-JP", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
};

export default async function AllDecisionsPage() {
  const viewer = await getViewerFromCookies();
  if (!viewer) {
    redirect(buildLoginPath("/decisions/all"));
  }

  const { cards, error } = await loadDecisionDashboardCards({
    isPaid: viewer.isPaid,
    userId: viewer.userId
  });

  return (
    <main className={styles.page}>
      <AnalyticsPageView page="/decisions/all" pageEventName="decisions_view" />

      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>すべてのトピック</p>
          <h1>トピックカードを一覧で確認する</h1>
          <p className={styles.lead}>
            今日のエピソードだけで足りないときに、公開中のトピックカードをまとめて確認できます。
          </p>
          <div className={styles.heroActions}>
            <Link href="/decisions" className={styles.secondaryHeroLink}>
              今日のエピソードへ戻る
            </Link>
          </div>
        </div>
      </section>

      {error ? <p className={styles.errorText}>読み込みに失敗しました。時間をおいて再度お試しください。</p> : null}

      <section className={styles.recommendationSection}>
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.sectionEyebrow}>一覧</p>
            <h2>公開中のトピックカード</h2>
            <p className={styles.sectionCaption}>採用するか見送るかをここから整理できます。</p>
          </div>
          <span className={styles.sectionCount}>{cards.length}件</span>
        </div>

        {cards.length === 0 ? (
          <p className={styles.emptyText}>トピックカードはまだありません。</p>
        ) : (
          <div className={styles.grid}>
            {cards.map((card) => (
              <article key={card.id} className={styles.card}>
                <AnalyticsEventOnRender
                  eventName="judgment_card_impression"
                  properties={{
                    page: "/decisions/all",
                    source: "decision_all_card",
                    episode_id: card.episode_id,
                    judgment_card_id: card.id,
                    genre: card.genre ?? undefined,
                    frame_type: card.frame_type ?? undefined,
                    judgment_type: card.judgment_type
                  }}
                />
                <TrackedLink
                  href={`/decisions/${card.episode_id}`}
                  className={styles.cardLink}
                  eventName="judgment_card_click"
                  eventProperties={{
                    page: "/decisions/all",
                    source: "decision_all_card",
                    episode_id: card.episode_id,
                    judgment_card_id: card.id,
                    genre: card.genre ?? undefined,
                    frame_type: card.frame_type ?? undefined,
                    judgment_type: card.judgment_type
                  }}
                >
                  <div className={styles.cardHeader}>
                    <span className={`${styles.badge} ${styles[`badge_${card.judgment_type}`]}`.trim()}>
                      {JUDGMENT_TYPE_LABELS[card.judgment_type]}
                    </span>
                    <span className={styles.genreTag}>{formatGenreLabel(card.genre)}</span>
                  </div>
                  <h3>{formatTopicTitle(card.topic_title)}</h3>
                  <p className={styles.summary}>{card.judgment_summary}</p>
                  {viewer.isPaid ? (
                    <dl className={styles.metaList}>
                      <div>
                        <dt>詳細</dt>
                        <dd>{card.judgment_summary}</dd>
                      </div>
                      <div>
                        <dt>次の行動</dt>
                        <dd>{card.action_text ?? "詳細を開いて確認する"}</dd>
                      </div>
                      <div>
                        <dt>見直しタイミング</dt>
                        <dd>{card.deadline_at ? formatDeadline(card.deadline_at) : "今週中に見直す"}</dd>
                      </div>
                    </dl>
                  ) : (
                    <PremiumPreview
                      placeholders={[
                        { label: "詳細", value: "詳しい根拠を表示" },
                        { label: "次の行動", value: "具体的な行動を提案" },
                        { label: "見直しタイミング", value: "最適な時期を表示" }
                      ]}
                      message="詳細と行動提案を確認"
                      page="/decisions/all"
                      source="decision_all_card_preview"
                    />
                  )}
                  <p className={styles.episodeLinkText}>詳細を見る</p>
                </TrackedLink>

                <div className={styles.cardActionRow}>
                  <JudgmentCardActions
                    judgmentCardId={card.id}
                    viewer={viewer}
                    initialItemId={card.watchlist_item_id}
                    initialStatus={card.watchlist_status}
                    savedDecisionId={card.saved_decision_id}
                    savedOutcome={card.saved_outcome}
                    page="/decisions/all"
                    source="decision_all_card"
                    episodeId={card.episode_id}
                    genre={card.genre}
                    frameType={card.frame_type}
                    judgmentType={card.judgment_type}
                  />
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
