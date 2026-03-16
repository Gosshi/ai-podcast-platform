import { redirect } from "next/navigation";
import AnalyticsEventOnRender from "@/app/components/AnalyticsEventOnRender";
import AnalyticsPageView from "@/app/components/AnalyticsPageView";
import AudioPlayer from "@/app/components/AudioPlayer";
import PremiumPreview from "@/app/components/PremiumPreview";
import TrackedLink from "@/app/components/TrackedLink";
import { loadPublishedEpisodes } from "@/app/lib/episodes";
import { buildLoginPath, buildOnboardingPath } from "@/app/lib/onboarding";
import { formatGenreLabel, formatTopicTitle, JUDGMENT_TYPE_LABELS } from "@/app/lib/uiText";
import { getViewerFromCookies } from "@/app/lib/viewer";
import styles from "./page.module.css";

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

      {/* --- Today's Episode Hero --- */}
      <section className={styles.hero}>
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
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>Today&apos;s Podcast</p>
          <h1>{latestEpisode?.title ?? "今日のエピソードを準備中です"}</h1>
          {latestEpisode?.description ? (
            <p className={styles.lead}>{latestEpisode.description}</p>
          ) : !latestEpisode ? (
            <p className={styles.lead}>
              あなたの関心に合わせた最新エピソードをまもなくお届けします。
            </p>
          ) : null}
        </div>
      </section>

      {/* --- Audio Player --- */}
      <section className={styles.playerSection}>
        <AudioPlayer
          src={latestEpisode?.audio_url ?? null}
          title={latestEpisode?.title ?? "エピソード準備中"}
          description={latestEpisode?.description}
        />
      </section>

      {/* --- Judgment Cards from Episode --- */}
      {judgmentCards.length > 0 ? (
        <section className={styles.recommendationSection}>
          <div className={styles.recommendationHeader}>
            <div>
              <p className={styles.sectionEyebrow}>判断カード</p>
              <h2>エピソードの判断ポイント</h2>
              <p className={styles.sectionCaption}>
                今日のエピソードから抽出された判断カードです。
              </p>
            </div>
            <div className={styles.countRow}>
              <span>{judgmentCards.length}件</span>
            </div>
          </div>

          <div className={styles.recommendationGrid}>
            {judgmentCards.map((card) => (
              <article key={card.id} className={styles.recommendationCard}>
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
                  <div className={styles.recommendationTopRow}>
                    <span className={`${styles.badge} ${styles[`badge_${card.judgment_type}`] ?? ""}`.trim()}>
                      {JUDGMENT_TYPE_LABELS[card.judgment_type]}
                    </span>
                    <span className={styles.genreTag}>{formatGenreLabel(card.genre ?? null)}</span>
                  </div>
                  <h3>{formatTopicTitle(card.topic_title)}</h3>
                  <p className={styles.summary}>{card.judgment_summary}</p>
                  {isPaid ? (
                    <>
                      {card.action_text ? (
                        <dl className={styles.metaList}>
                          <div>
                            <dt>次の行動</dt>
                            <dd>{card.action_text}</dd>
                          </div>
                        </dl>
                      ) : null}
                    </>
                  ) : (
                    <PremiumPreview
                      placeholders={[
                        { label: "次の行動", value: "具体的な行動を提案します" }
                      ]}
                      message="有料版で行動提案を確認"
                      page="/decisions"
                      source="episode_card_preview"
                    />
                  )}
                  <p className={styles.episodeLinkText}>詳細を見る</p>
                </TrackedLink>
              </article>
            ))}
          </div>
        </section>
      ) : latestEpisode ? (
        <section className={styles.recommendationSection}>
          <p className={styles.emptyText}>
            このエピソードには判断カードがまだ生成されていません。
          </p>
        </section>
      ) : null}

      {/* --- All Episodes Link --- */}
      <div className={styles.allLinkPanel}>
        <div>
          <p className={styles.sectionEyebrow}>アーカイブ</p>
          <h3>過去のエピソードはこちらから</h3>
          <p className={styles.sectionCaption}>
            すべてのエピソードと判断カードを一覧で確認できます。
          </p>
        </div>
        <TrackedLink
          href="/episodes"
          className={styles.inlineUpgradeLink}
          eventName="nav_click"
          eventProperties={{
            page: "/decisions",
            source: "podcast_dashboard_episodes_link",
            destination: "/episodes"
          }}
        >
          すべてのエピソードを見る
        </TrackedLink>
      </div>

      {/* --- Onboarding Prompt --- */}
      {viewer.needsOnboarding ? (
        <div className={styles.allLinkPanel}>
          <div>
            <p className={styles.sectionEyebrow}>設定</p>
            <h3>好みを設定して、あなた専用のポッドキャストを受け取ろう</h3>
            <p className={styles.sectionCaption}>
              関心のあるジャンルやトピックを設定すると、より精度の高いエピソードが届きます。
            </p>
          </div>
          <TrackedLink
            href={onboardingPath}
            className={styles.inlineUpgradeLink}
            eventName="onboarding_entry_click"
            eventProperties={{
              page: "/decisions",
              source: "podcast_dashboard_onboarding",
              destination: onboardingPath
            }}
          >
            好みを設定する
          </TrackedLink>
        </div>
      ) : null}

      {showWelcome ? (
        <AnalyticsEventOnRender
          eventName="welcome_shown"
          properties={{ page: "/decisions" }}
        />
      ) : null}

      {error ? (
        <p className={styles.errorText}>
          エピソードの読み込みに失敗しました。時間をおいて再度お試しください。
        </p>
      ) : null}

      {/* --- Paywall Banner --- */}
      {!isPaid ? (
        <section className={styles.paywallBanner}>
          <div>
            <p className={styles.paywallEyebrow}>Premium</p>
            <h2>有料版でフルスクリプトと行動提案を確認</h2>
            <p>
              無料版はエピソード再生と判断カードの概要まで。有料版でスクリプト全文、行動提案、アーカイブが使えます。
            </p>
          </div>
          <TrackedLink
            href="/account"
            className={styles.paywallLink}
            eventName="subscribe_cta_click"
            eventProperties={{
              page: "/decisions",
              source: "podcast_dashboard_paywall_banner"
            }}
          >
            プランを見る
          </TrackedLink>
        </section>
      ) : null}
    </main>
  );
}
