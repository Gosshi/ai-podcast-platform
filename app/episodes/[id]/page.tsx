import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import MemberControls from "@/app/components/MemberControls";
import PostListenCTA from "@/app/components/PostListenCTA";
import ShareButton from "@/app/components/ShareButton";
import TrackedLink from "@/app/components/TrackedLink";
import { resolveEpisodeDescription } from "@/src/lib/episodeDescriptions";
import { loadPublicEpisodeById } from "@/app/lib/episodes";
import { formatThresholdHighlights } from "@/app/lib/judgmentAccess";
import { buildLoginPath } from "@/app/lib/onboarding";
import { resolveDisplayEpisodeTitle } from "@/src/lib/episodeTitles";
import {
  formatFrameTypeLabel,
  formatGenreLabel,
  formatTopicTitle,
  JUDGMENT_TYPE_LABELS
} from "@/app/lib/uiText";
import { getViewerFromCookies } from "@/app/lib/viewer";
import { buildPublicEpisodePath, buildPublicEpisodeUrl } from "@/src/lib/episodeLinks";
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

export async function generateMetadata({
  params
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const { episode } = await loadPublicEpisodeById({
    episodeId: id,
    isPaid: false
  });

  if (!episode) {
    return { title: "公開エピソード" };
  }

  const formattedTitle = resolveDisplayEpisodeTitle({
    title: episode.title,
    judgmentCards: episode.judgment_cards,
    fallback: "公開エピソード"
  });
  const formattedDescription = resolveEpisodeDescription({
    description: episode.description,
    previewText: episode.preview_text,
    judgmentCards: episode.judgment_cards,
    fallback: "判断のじかんの公開エピソードです。"
  });
  const ogImageUrl = `/api/og?title=${encodeURIComponent(formattedTitle)}${episode.genre ? `&genre=${encodeURIComponent(episode.genre)}` : ""}`;

  return {
    title: `${formattedTitle} | 公開エピソード`,
    description: formattedDescription,
    alternates: {
      canonical: buildPublicEpisodePath(id)
    },
    openGraph: {
      title: formattedTitle,
      description: formattedDescription,
      url: buildPublicEpisodePath(id),
      images: [{ url: ogImageUrl, width: 1200, height: 630, alt: formattedTitle }]
    }
  };
}

export default async function PublicEpisodePage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const viewer = await getViewerFromCookies();
  const isPaid = viewer?.isPaid ?? false;
  const publicPath = buildPublicEpisodePath(id);
  const publicUrl = buildPublicEpisodeUrl(id);
  const memberPath = `/decisions/${id}`;

  const { episode, error } = await loadPublicEpisodeById({
    episodeId: id,
    isPaid,
    userId: viewer?.userId
  });
  const displayTitle = episode
    ? resolveDisplayEpisodeTitle({
        title: episode.title,
        judgmentCards: episode.judgment_cards
      })
    : "公開エピソード";
  const displayDescription = episode
    ? resolveEpisodeDescription({
        description: episode.description,
        previewText: episode.preview_text,
        judgmentCards: episode.judgment_cards,
        fallback: "この回の要点を無料で確認できます。気になったら、そのまま有料版で詳細まで続けられます。"
      })
    : "この回の要点を無料で確認できます。";

  if (!episode && !error) {
    notFound();
  }

  return (
    <main className={styles.page}>
      <div className={styles.backRow}>
        <Link href="/">ホーム</Link>
        <Link href="/episodes">エピソード一覧</Link>
      </div>

      {error ? <p className={styles.errorText}>公開エピソードの読み込みに失敗しました。時間をおいて再度お試しください。</p> : null}

      {episode ? (
        <>
          <section className={styles.hero}>
            <div className={styles.heroCopy}>
              <p className={styles.eyebrow}>Public Episode</p>
              <h1>{displayTitle}</h1>
              <p className={styles.lead}>{displayDescription}</p>
              <div className={styles.metaRow}>
                <span>{formatLanguageLabel(episode.lang)}</span>
                <span>{formatGenreLabel(episode.genre)}</span>
                <span>{formatDateTime(episode.published_at ?? episode.created_at)}</span>
              </div>
              <div className={styles.summaryRow}>
                <span className={styles.summaryBadge}>無料で要点まで確認</span>
                <span className={styles.summaryBadge}>有料版で行動提案と振り返り</span>
              </div>
              <p className={styles.summaryText}>
                無料では、この回の概要と判断カードの要点まで公開します。ログイン後は、行動提案、見直しタイミング、履歴への保存まで進められます。
              </p>
            </div>

            <MemberControls
              viewer={viewer}
              title="この回を続ける"
              copy="無料版は要点まで。有料版では判断カードの深掘り、フルスクリプト、見直しタイミング、振り返りまで使えます。"
              analyticsSource={publicPath}
              variant="compact"
              authRedirectPath={publicPath}
            />
          </section>

          <section className={styles.playerSection}>
            <PostListenCTA
              src={episode.audio_url ?? null}
              title={displayTitle}
              description={displayDescription}
              hasCards={episode.judgment_cards.length > 0}
              page={publicPath}
              episodeId={episode.id}
            />
            <div className={styles.playerActions}>
              <ShareButton
                title={displayTitle}
                text={displayDescription}
                url={publicUrl}
                page={publicPath}
                source="public_episode"
                episodeId={episode.id}
              />
              <TrackedLink
                href={viewer ? memberPath : buildLoginPath(memberPath)}
                className={styles.secondaryLink}
                eventName="nav_click"
                eventProperties={{
                  page: publicPath,
                  source: "public_episode_member_link",
                  destination: viewer ? memberPath : buildLoginPath(memberPath)
                }}
              >
                {viewer ? "会員向け詳細を見る" : "ログインして詳細を見る"}
              </TrackedLink>
            </div>
          </section>

          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2>この回の判断ポイント</h2>
              <span className={styles.pill}>{episode.judgment_card_count}件</span>
            </div>

            {episode.judgment_cards.length > 0 ? (
              <div className={styles.cardGrid}>
                {episode.judgment_cards.map((card) => (
                  <article key={card.id} className={styles.card}>
                    <div className={styles.cardHeader}>
                      <span className={`${styles.badge} ${styles[`badge_${card.judgment_type}`]}`.trim()}>
                        {JUDGMENT_TYPE_LABELS[card.judgment_type]}
                      </span>
                      <span className={styles.pill}>
                        {formatFrameTypeLabel(card.frame_type, "判断ポイント")}
                      </span>
                    </div>
                    <h3>{formatTopicTitle(card.topic_title)}</h3>
                    <p className={styles.summaryText}>{card.judgment_summary}</p>

                    {isPaid ? (
                      <>
                        <dl className={styles.metaList}>
                          {card.action_text ? (
                            <div>
                              <dt>次の行動</dt>
                              <dd>{card.action_text}</dd>
                            </div>
                          ) : null}
                          {card.deadline_at ? (
                            <div>
                              <dt>見直しタイミング</dt>
                              <dd>{formatDateTime(card.deadline_at)}</dd>
                            </div>
                          ) : null}
                        </dl>
                        {card.watch_points.length > 0 ? (
                          <ul className={styles.list}>
                            {card.watch_points.map((point) => (
                              <li key={point}>{point}</li>
                            ))}
                          </ul>
                        ) : null}
                        {formatThresholdHighlights(card.threshold_json).length > 0 ? (
                          <ul className={styles.list}>
                            {formatThresholdHighlights(card.threshold_json).map((item) => (
                              <li key={item}>{item}</li>
                            ))}
                          </ul>
                        ) : null}
                      </>
                    ) : null}
                  </article>
                ))}
              </div>
            ) : (
              <p className={styles.emptyState}>この回の判断ポイントはまだ準備中です。</p>
            )}

            {!isPaid ? (
              <div className={styles.upgradeCard}>
                <h2>有料版で増えるもの</h2>
                <p>要点の先にある「どう動くか」まで確認したい場合は、有料版で続けられます。</p>
                <ul className={styles.upgradeList}>
                  <li>判断カードごとの行動提案</li>
                  <li>見直しタイミングと比較基準</li>
                  <li>履歴保存と Replay / Alerts</li>
                </ul>
                <div className={styles.ctaRow}>
                  <TrackedLink
                    href="/login?next=/account"
                    className={styles.primaryLink}
                    eventName="subscribe_cta_click"
                    eventProperties={{
                      page: publicPath,
                      source: "public_episode_upgrade"
                    }}
                  >
                    7日無料で試す
                  </TrackedLink>
                </div>
              </div>
            ) : null}
          </section>

          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2>{isPaid ? "フルスクリプト" : "公開プレビュー"}</h2>
            </div>
            <pre className={styles.scriptBlock}>{episode.full_script ?? episode.preview_text ?? "台本はまだありません。"}</pre>
            {episode.archive_locked && !isPaid ? (
              <p className={styles.summaryText}>
                この回は無料版のアーカイブ対象外です。公開ページでは要点を残し、全文と深い判断支援は有料版で開放します。
              </p>
            ) : null}
          </section>
        </>
      ) : null}
    </main>
  );
}
