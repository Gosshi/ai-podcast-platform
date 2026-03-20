import { redirect } from "next/navigation";
import AnalyticsEventOnRender from "@/app/components/AnalyticsEventOnRender";
import AnalyticsPageView from "@/app/components/AnalyticsPageView";
import PostListenCTA from "@/app/components/PostListenCTA";
import GenerateCardForm from "@/app/components/GenerateCardForm";
import ShareButton from "@/app/components/ShareButton";
import TrackedLink from "@/app/components/TrackedLink";
import TutorialTrigger from "@/app/components/TutorialTrigger";
import type { Metadata } from "next";
import { loadPublishedEpisodes } from "@/app/lib/episodes";
import { buildLoginPath, buildOnboardingPath } from "@/app/lib/onboarding";
import { formatGenreLabel, formatTopicTitle, JUDGMENT_TYPE_LABELS } from "@/app/lib/uiText";
import { getViewerFromCookies } from "@/app/lib/viewer";
import { PRODUCT_NAME } from "@/src/lib/brand";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "今日のエピソード",
  description: "今日のAIポッドキャストとトピックカード。聴いた内容をもとに「やる・様子見・見送り」を判断できます。"
};

export const dynamic = "force-dynamic";

export default async function DecisionsPage({
  searchParams
}: {
  searchParams: Promise<{ welcome?: string }>;
}) {
  const viewer = await getViewerFromCookies();
  if (!viewer) {
    redirect(buildLoginPath("/decisions"));
  }
  const params = await searchParams;
  const showWelcome = params.welcome === "1";

  const isPaid = viewer?.isPaid ?? false;
  const onboardingPath = buildOnboardingPath("/decisions");

  const { episodes, error } = await loadPublishedEpisodes({
    genreFilter: null,
    isPaid,
    userId: viewer?.userId
  });

  const latestEpisode = episodes.length > 0 ? episodes[0] : null;
  const judgmentCards = latestEpisode?.judgment_cards ?? [];

  return (
    <main className={styles.page}>
      <AnalyticsPageView page="/decisions" pageEventName="decisions_view" />

      {/* --- Episode Player Hero (merged) --- */}
      <section className={styles.playerHero}>
        <AnalyticsEventOnRender
          eventName="podcast_hero_impression"
          properties={{
            page: "/decisions",
            source: "podcast_hero",
            is_paid: isPaid,
            has_episode: Boolean(latestEpisode),
            episode_id: latestEpisode?.id ?? undefined
          }}
        />

        <div className={styles.playerHeroMeta}>
          <p className={styles.eyebrow}>今日のポッドキャスト</p>
        </div>

        <PostListenCTA
          src={latestEpisode?.audio_url ?? null}
          title={latestEpisode?.title ?? "エピソード準備中"}
          description={latestEpisode?.description}
          hasCards={judgmentCards.length > 0}
          page="/decisions"
          episodeId={latestEpisode?.id}
        />

        {latestEpisode ? (
          <div className={styles.playerHeroActions}>
            <ShareButton
              title={latestEpisode.title ?? PRODUCT_NAME}
              text={latestEpisode.description ?? undefined}
              url={`/decisions/${latestEpisode.id}`}
              page="/decisions"
              source="podcast_hero"
              episodeId={latestEpisode.id}
            />
            <TrackedLink
              href={`/decisions/${latestEpisode.id}`}
              className={styles.detailLink}
              eventName="nav_click"
              eventProperties={{
                page: "/decisions",
                source: "player_hero_detail_link",
                destination: `/decisions/${latestEpisode.id}`
              }}
            >
              エピソード詳細 →
            </TrackedLink>
          </div>
        ) : null}
      </section>

      {error ? (
        <p className={styles.errorText}>
          エピソードの読み込みに失敗しました。時間をおいて再度お試しください。
        </p>
      ) : null}

      {/* --- Topic Cards --- */}
      {judgmentCards.length > 0 ? (
        <section id="topic-cards" className={styles.recommendationSection}>
          <div className={styles.recommendationHeader}>
            <h2>トピックカード</h2>
            <div className={styles.countRow}>
              <span>{judgmentCards.length}件</span>
            </div>
          </div>

          <div className={styles.recommendationGrid}>
            {judgmentCards.map((card) => (
              <article key={card.id} className={`${styles.recommendationCard} ${styles[`card_${card.judgment_type}`] ?? ""}`.trim()}>
                <AnalyticsEventOnRender
                  eventName="judgment_card_impression"
                  properties={{
                    page: "/decisions",
                    source: "episode_judgment_card",
                    episode_id: latestEpisode?.id ?? undefined,
                    judgment_card_id: card.id,
                    genre: card.genre ?? undefined,
                    judgment_type: card.judgment_type
                  }}
                />
                <TrackedLink
                  href={`/decisions/${latestEpisode?.id}`}
                  className={styles.recommendationLink}
                  eventName="judgment_card_click"
                  eventProperties={{
                    page: "/decisions",
                    source: "episode_judgment_card",
                    episode_id: latestEpisode?.id ?? undefined,
                    judgment_card_id: card.id,
                    judgment_type: card.judgment_type
                  }}
                >
                  <span className={`${styles.judgmentBadgeLarge} ${styles[`judgmentBadge_${card.judgment_type}`] ?? ""}`.trim()}>
                    {JUDGMENT_TYPE_LABELS[card.judgment_type]}
                  </span>
                  <h3>{formatTopicTitle(card.topic_title)}</h3>
                  <span className={styles.genreTagInline}>{formatGenreLabel(card.genre ?? null)}</span>
                </TrackedLink>
              </article>
            ))}
          </div>
        </section>
      ) : latestEpisode ? (
        <section className={styles.recommendationSection}>
          <p className={styles.emptyText}>
            このエピソードにはトピックカードがまだ生成されていません。
          </p>
        </section>
      ) : null}

      {/* --- Quick Links --- */}
      <div className={styles.quickLinksRow}>
        <TrackedLink
          href="/episodes"
          className={styles.quickLink}
          eventName="nav_click"
          eventProperties={{
            page: "/decisions",
            source: "podcast_dashboard_episodes_link",
            destination: "/episodes"
          }}
        >
          <span className={styles.quickLinkIcon}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.75 5.75h14.5" /><path d="M4.75 9.75h14.5" /><path d="M4.75 13.75h8.5" /><path d="M4.75 17.75h8.5" /></svg>
          </span>
          過去のエピソード
        </TrackedLink>
        {viewer.needsOnboarding ? (
          <TrackedLink
            href={onboardingPath}
            className={styles.quickLink}
            eventName="onboarding_entry_click"
            eventProperties={{
              page: "/decisions",
              source: "podcast_dashboard_onboarding",
              destination: onboardingPath
            }}
          >
            <span className={styles.quickLinkIcon}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4.75v14.5" /><path d="M18.25 12H5.75" /></svg>
            </span>
            好みを設定する
          </TrackedLink>
        ) : null}
        {!isPaid ? (
          <TrackedLink
            href="/account"
            className={styles.quickLink}
            eventName="subscribe_cta_click"
            eventProperties={{
              page: "/decisions",
              source: "podcast_dashboard_upgrade_link"
            }}
          >
            <span className={styles.quickLinkIcon}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4.75l2.5 5 5.5.8-4 3.9.94 5.5L12 17.25l-4.94 2.7.94-5.5-4-3.9 5.5-.8Z" /></svg>
            </span>
            有料版にアップグレード
          </TrackedLink>
        ) : null}
        <TutorialTrigger page="/decisions" autoOpen={showWelcome} />
      </div>

      {/* --- AI Consult --- */}
      <GenerateCardForm isPaid={isPaid} showWelcome={showWelcome} />
    </main>
  );
}
