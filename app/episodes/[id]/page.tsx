import Link from "next/link";
import { notFound } from "next/navigation";
import DecisionCalculator from "@/app/components/DecisionCalculator";
import MemberControls from "@/app/components/MemberControls";
import SaveDecisionButton from "@/app/components/SaveDecisionButton";
import { formatThresholdHighlights } from "@/app/lib/judgmentAccess";
import { loadPublishedEpisodeById } from "@/app/lib/episodes";
import { getViewerFromCookies } from "@/app/lib/viewer";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

const JUDGMENT_TYPE_LABELS = {
  use_now: "使う",
  watch: "監視",
  skip: "見送り"
} as const;

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

export default async function EpisodeDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const viewer = await getViewerFromCookies();
  const { episode, error } = await loadPublishedEpisodeById({
    episodeId: id,
    isPaid: viewer?.isPaid ?? false,
    userId: viewer?.userId
  });

  if (!episode && !error) {
    notFound();
  }

  return (
    <main className={styles.page}>
      <div className={styles.backRow}>
        <Link href="/decisions">Decisions</Link>
        <Link href="/episodes">Episodes</Link>
      </div>

      {error ? <p className={styles.errorText}>エピソードの読み込みに失敗しました: {error}</p> : null}

      {episode ? (
        <>
          <section className={styles.hero}>
            <div className={styles.heroCopy}>
              <p className={styles.eyebrow}>Episode Detail</p>
              <h1>{episode.title ?? "Untitled episode"}</h1>
              <div className={styles.metaRow}>
                <span>{episode.lang.toUpperCase()}</span>
                <span>{episode.genre ?? "general"}</span>
                <span>{formatDateTime(episode.published_at ?? episode.created_at)}</span>
              </div>

              {episode.audio_url ? (
                <audio className={styles.audio} controls src={episode.audio_url}>
                  Your browser does not support audio playback.
                </audio>
              ) : null}
            </div>

            <MemberControls
              viewer={viewer}
              title="Access Level"
              copy="無料版は judgment summary まで。有料会員になると action、deadline、watch points、threshold、full DeepDive を開放します。"
            />
          </section>

          <section className={styles.section}>
            <div className={styles.sectionHeading}>
              <h2>Judgment Cards</h2>
              <span>{episode.judgment_card_count}件</span>
            </div>

            {episode.judgment_cards.length === 0 ? (
              <p className={styles.emptyText}>判断カードはまだありません。</p>
            ) : (
              <div className={styles.cardGrid}>
                {episode.judgment_cards.map((card) => (
                  <article key={card.id} className={styles.card}>
                    <div className={styles.cardHeader}>
                      <span className={`${styles.badge} ${styles[`badge_${card.judgment_type}`]}`.trim()}>
                        {JUDGMENT_TYPE_LABELS[card.judgment_type]}
                      </span>
                      <span className={styles.topicOrder}>Topic {card.topic_order}</span>
                    </div>
                    <h3>{card.topic_title}</h3>
                    <p className={styles.summary}>{card.judgment_summary}</p>
                    <div className={styles.cardActions}>
                      <SaveDecisionButton
                        judgmentCardId={card.id}
                        viewer={viewer}
                        initialSaved={card.is_saved}
                      />
                    </div>
                    <DecisionCalculator card={card} isPaid={viewer?.isPaid ?? false} locale="ja" />
                    <dl className={styles.metaList}>
                      {card.action_text ? (
                        <div>
                          <dt>次の行動</dt>
                          <dd>{card.action_text}</dd>
                        </div>
                      ) : null}
                      {card.deadline_at ? (
                        <div>
                          <dt>期限</dt>
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
                    {!viewer?.isPaid ? (
                      <div className={styles.lockedBlock}>
                        <strong>この先は有料会員向け</strong>
                        <p>次の行動、判断期限、監視ポイント、threshold の詳細を開放します。</p>
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>
            )}

            {episode.judgment_cards_preview_limited ? (
              <p className={styles.lockedText}>
                無料版では judgment summary まで表示し、action / deadline / watch points / threshold は有料会員向けに制限しています。
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
              <h2>{episode.full_script ? "DeepDive Script" : "Preview Script"}</h2>
              <span>{episode.full_script ? "Paid" : "Free"}</span>
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
