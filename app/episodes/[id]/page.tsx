import Link from "next/link";
import { notFound } from "next/navigation";
import MemberControls from "@/app/components/MemberControls";
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
    isPaid: viewer?.isPaid ?? false
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
              copy="無料版は判断カードのプレビューと preview script まで。有料会員になると全文と archive を開放します。"
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
                    <dl className={styles.metaList}>
                      <div>
                        <dt>期限</dt>
                        <dd>{formatDateTime(card.deadline_at)}</dd>
                      </div>
                      {card.action_text ? (
                        <div>
                          <dt>次の行動</dt>
                          <dd>{card.action_text}</dd>
                        </div>
                      ) : null}
                    </dl>
                  </article>
                ))}
              </div>
            )}

            {episode.judgment_cards_preview_limited ? (
              <p className={styles.lockedText}>
                無料版では判断カードの詳細を一部制限しています。全文は有料会員で表示されます。
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
