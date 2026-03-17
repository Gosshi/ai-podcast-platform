import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import AnalyticsEventOnRender from "@/app/components/AnalyticsEventOnRender";
import AudioPlayer from "@/app/components/AudioPlayer";
import DecisionCalculator from "@/app/components/DecisionCalculator";
import JudgmentCardActions from "@/app/components/JudgmentCardActions";
import MemberControls from "@/app/components/MemberControls";
import PremiumPreview from "@/app/components/PremiumPreview";
import TrackedLink from "@/app/components/TrackedLink";
import { formatThresholdHighlights } from "@/app/lib/judgmentAccess";
import { buildLoginPath } from "@/app/lib/onboarding";
import { loadPublishedEpisodeById } from "@/app/lib/episodes";
import {
  formatEpisodeTitle,
  formatFrameTypeLabel,
  formatGenreLabel,
  formatTopicTitle,
  JUDGMENT_TYPE_LABELS
} from "@/app/lib/uiText";
import { getViewerFromCookies } from "@/app/lib/viewer";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

const formatDateTime = (value: string | null): string => {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("ja-JP", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
};

const formatLanguageLabel = (value: string): string => {
  return value.toLowerCase() === "ja" ? "日本語" : value.toLowerCase() === "en" ? "英語" : value.toUpperCase();
};

export default async function EpisodeDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const viewer = await getViewerFromCookies();
  if (!viewer) {
    redirect(buildLoginPath(`/decisions/${id}`));
  }

  const { episode, error } = await loadPublishedEpisodeById({
    episodeId: id,
    isPaid: viewer.isPaid,
    userId: viewer.userId
  });

  if (!episode && !error) {
    notFound();
  }

  return (
    <main className={styles.page}>
      <div className={styles.backRow}>
        <Link href="/decisions">今日のエピソード</Link>
        <Link href="/episodes">アーカイブ</Link>
      </div>

      {error ? <p className={styles.errorText}>読み込みに失敗しました。再読み込みしてください。</p> : null}

      {episode ? (
        <>
          <section className={styles.hero}>
            <div className={styles.heroCopy}>
              <p className={styles.eyebrow}>詳細</p>
              <h1>{formatEpisodeTitle(episode.title)}</h1>
              <div className={styles.metaRow}>
                <span>{formatLanguageLabel(episode.lang)}</span>
                <span>{formatGenreLabel(episode.genre)}</span>
                <span>{formatDateTime(episode.published_at ?? episode.created_at)}</span>
              </div>

            </div>

            <div className={styles.playerSection}>
              <AudioPlayer
                src={episode.audio_url ?? null}
                title={formatEpisodeTitle(episode.title)}
                description={episode.description}
              />
            </div>

            <MemberControls
              viewer={viewer}
              title="プラン"
              copy="無料版はタイトルと概要まで。有料版では詳細、行動提案、見直しタイミングまで見られます。"
              analyticsSource={`/decisions/${id}`}
              variant="compact"
            />
          </section>

          <section className={styles.section}>
            <div className={styles.sectionHeading}>
              <h2>トピックカード</h2>
              <span>{episode.judgment_card_count}件</span>
            </div>

            {episode.judgment_cards.length === 0 ? (
              <p className={styles.emptyText}>トピックカードはまだありません。</p>
            ) : (
              <div className={styles.cardGrid}>
                {episode.judgment_cards.map((card) => (
                  <article key={card.id} className={styles.card}>
                    <AnalyticsEventOnRender
                      eventName="judgment_card_impression"
                      properties={{
                        page: `/decisions/${id}`,
                        source: "episode_detail_card",
                        episode_id: episode.id,
                        judgment_card_id: card.id,
                        genre: card.genre ?? undefined,
                        frame_type: card.frame_type ?? undefined,
                        judgment_type: card.judgment_type
                      }}
                    />
                    <div className={styles.cardHeader}>
                      <span className={`${styles.badge} ${styles[`badge_${card.judgment_type}`]}`.trim()}>
                        {JUDGMENT_TYPE_LABELS[card.judgment_type]}
                      </span>
                      <span className={styles.topicOrder}>{formatFrameTypeLabel(card.frame_type, `トピック ${card.topic_order}`)}</span>
                    </div>
                    <h3>{formatTopicTitle(card.topic_title)}</h3>
                    <p className={styles.summary}>{card.judgment_summary}</p>
                    <div className={styles.cardActions}>
                      <JudgmentCardActions
                        judgmentCardId={card.id}
                        viewer={viewer}
                        initialItemId={card.watchlist_item_id}
                        initialStatus={card.watchlist_status}
                        savedDecisionId={card.saved_decision_id}
                        savedOutcome={card.saved_outcome}
                        page={`/decisions/${id}`}
                        source="episode_detail_card"
                        episodeId={episode.id}
                        genre={card.genre}
                        frameType={card.frame_type}
                        judgmentType={card.judgment_type}
                      />
                    </div>
                    <DecisionCalculator
                      card={card}
                      isPaid={viewer.isPaid}
                      locale="ja"
                      analyticsPage={`/decisions/${id}`}
                      analyticsSource="episode_detail_card"
                    />
                    {viewer.isPaid ? (
                      <>
                        <dl className={styles.metaList}>
                          {card.action_text ? (
                            <div>
                              <dt>次の行動</dt>
                              <dd>{card.action_text}</dd>
                            </div>
                          ) : null}
                          <div>
                            <dt>詳細</dt>
                            <dd>{card.judgment_summary}</dd>
                          </div>
                          {card.deadline_at ? (
                            <div>
                              <dt>見直しタイミング</dt>
                              <dd>{formatDateTime(card.deadline_at)}</dd>
                            </div>
                          ) : null}
                        </dl>
                        {card.watch_points.length > 0 ? (
                          <ul className={styles.detailList}>
                            {card.watch_points.map((point) => (
                              <li key={point}>{point}</li>
                            ))}
                          </ul>
                        ) : null}
                        {formatThresholdHighlights(card.threshold_json).length > 0 ? (
                          <ul className={styles.detailList}>
                            {formatThresholdHighlights(card.threshold_json).map((item) => (
                              <li key={item}>{item}</li>
                            ))}
                          </ul>
                        ) : null}
                      </>
                    ) : (
                      <PremiumPreview
                        placeholders={[
                          { label: "次の行動", value: "具体的な行動を提案します" },
                          { label: "詳細", value: "詳しい根拠を表示" },
                          { label: "見直しタイミング", value: "最適な見直し時期" }
                        ]}
                        message="詳細と行動提案を確認"
                        page={`/decisions/${id}`}
                        source="episode_detail_card_preview"
                      />
                    )}
                  </article>
                ))}
              </div>
            )}

            {episode.judgment_cards_preview_limited ? (
              <p className={styles.lockedText}>
                無料版ではタイトルと概要まで表示し、詳細や見直しタイミングは有料会員向けに制限しています。
              </p>
            ) : null}

            {episode.archive_locked ? (
              <p className={styles.lockedText}>
                このエピソードは無料版の公開期間を過ぎています。最新1週間は無料で確認でき、過去アーカイブは有料会員で開放します。
              </p>
            ) : null}
          </section>

          <section className={styles.section}>
            <div className={styles.sectionHeading}>
              <h2>{episode.full_script ? "詳しい内容" : "概要"}</h2>
              <span>{episode.full_script ? "有料版" : "無料版"}</span>
            </div>

            {episode.full_script ?? episode.preview_text ? (
              <pre className={styles.scriptBlock}>{episode.full_script ?? episode.preview_text}</pre>
            ) : (
              <p className={styles.emptyText}>台本はまだありません。</p>
            )}
          </section>
        </>
      ) : null}
    </main>
  );
}
