import { redirect } from "next/navigation";
import AnalyticsEventOnRender from "@/app/components/AnalyticsEventOnRender";
import AnalyticsPageView from "@/app/components/AnalyticsPageView";
import GenerateCardForm from "@/app/components/GenerateCardForm";
import PremiumPreview from "@/app/components/PremiumPreview";
import TrackedLink from "@/app/components/TrackedLink";
import { loadDecisionDashboardCards } from "@/app/lib/decisions";
import { buildLoginPath, buildOnboardingPath } from "@/app/lib/onboarding";
import { formatEpisodeTitle, formatGenreLabel, formatTopicTitle, JUDGMENT_TYPE_LABELS } from "@/app/lib/uiText";
import { getViewerFromCookies } from "@/app/lib/viewer";
import { rankNextBestDecisions } from "@/src/lib/nextBestDecision";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

const URGENCY_LEVEL_LABELS = {
  critical: "最優先",
  high: "高優先",
  medium: "確認",
  low: "低優先"
} as const;

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
  const onboardingEntryHref = onboardingPath;

  const { cards, error } = await loadDecisionDashboardCards({ isPaid, userId: viewer?.userId });

  const nextBestDecisions = rankNextBestDecisions({
    cards,
    isPaid,
    profile: null,
    preferenceProfile: viewer?.preferenceProfile
  });
  const featuredDecisions = nextBestDecisions.slice(0, 3);

  return (
    <main className={styles.page}>
      <AnalyticsPageView page="/decisions" pageEventName="decisions_view" />

      <section className={styles.hero}>
        <AnalyticsEventOnRender
          eventName="decisions_intro_impression"
          properties={{
            page: "/decisions",
            source: "decisions_intro",
            is_paid: isPaid,
            needs_onboarding: Boolean(viewer?.needsOnboarding)
          }}
        />
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>今日のおすすめ</p>
          <h1>今日のおすすめ</h1>
          <p className={styles.lead}>今日の判断を、好みや履歴をもとに短いカードでまとめています。</p>
          <div className={styles.heroActions}>
            {viewer.needsOnboarding ? (
              <TrackedLink
                href={onboardingEntryHref}
                className={styles.secondaryHeroLink}
                eventName="onboarding_entry_click"
                eventProperties={{
                  page: "/decisions",
                  source: "decisions_intro",
                  destination: onboardingPath
                }}
              >
                好みを設定する
              </TrackedLink>
            ) : null}
            <TrackedLink
              href="/decisions/all"
              className={styles.heroLink}
              eventName="nav_click"
              eventProperties={{
                page: "/decisions",
                source: "decision_dashboard_hero_all_link",
                destination: "/decisions/all"
              }}
            >
              すべての判断を見る
            </TrackedLink>
          </div>
        </div>
      </section>

      <GenerateCardForm isPaid={isPaid} showWelcome={showWelcome} />

      <section className={styles.recommendationSection}>
        <div className={styles.recommendationHeader}>
          <div>
            <p className={styles.sectionEyebrow}>今日のおすすめ</p>
            <h2>今日のおすすめ判断</h2>
            <p className={styles.sectionCaption}>
              まず最初に見ておきたい判断だけを上にまとめています。
            </p>
          </div>
        </div>

        {featuredDecisions.length === 0 ? (
          <p className={styles.emptyText}>今すぐおすすめできる判断カードはまだありません。</p>
        ) : (
          <div className={styles.recommendationGrid}>
            {featuredDecisions.map((recommendation) => (
              <article key={recommendation.card.id} className={styles.recommendationCard}>
                <AnalyticsEventOnRender
                  eventName="next_best_decision_impression"
                  properties={{
                    page: "/decisions",
                    source: "next_best_decision",
                    episode_id: recommendation.card.episode_id,
                    judgment_card_id: recommendation.card.id,
                    genre: recommendation.card.genre ?? undefined,
                    frame_type: recommendation.card.frame_type ?? undefined,
                    judgment_type: recommendation.card.judgment_type
                  }}
                />
                <TrackedLink
                  href={`/decisions/${recommendation.card.episode_id}`}
                  className={styles.recommendationLink}
                  eventName="next_best_decision_click"
                  eventProperties={{
                    page: "/decisions",
                    source: "next_best_decision",
                    episode_id: recommendation.card.episode_id,
                    judgment_card_id: recommendation.card.id,
                    genre: recommendation.card.genre ?? undefined,
                    frame_type: recommendation.card.frame_type ?? undefined,
                    judgment_type: recommendation.card.judgment_type
                  }}
                >
                  <div className={styles.recommendationTopRow}>
                    <span className={`${styles.badge} ${styles[`badge_${recommendation.card.judgment_type}`]}`.trim()}>
                      {JUDGMENT_TYPE_LABELS[recommendation.card.judgment_type]}
                    </span>
                    <span className={`${styles.urgencyBadge} ${styles[`urgencyBadge_${recommendation.urgency_level}`]}`.trim()}>
                      {URGENCY_LEVEL_LABELS[recommendation.urgency_level]}
                    </span>
                  </div>
                  <div className={styles.recommendationMetaRow}>
                    <span className={styles.genreTag}>{formatGenreLabel(recommendation.card.genre)}</span>
                    <span className={styles.recommendationEpisodeLabel}>
                      {formatEpisodeTitle(recommendation.card.episode_title)}
                    </span>
                  </div>
                  <h3>{formatTopicTitle(recommendation.card.topic_title)}</h3>
                  <p className={styles.summary}>{recommendation.card.judgment_summary}</p>
                  {isPaid ? (
                    <>
                      <dl className={styles.metaList}>
                        <div>
                          <dt>次の行動</dt>
                          <dd>{recommendation.recommended_action}</dd>
                        </div>
                        <div>
                          <dt>見直しタイミング</dt>
                          <dd>
                            {recommendation.card.deadline_at
                              ? formatDeadline(recommendation.card.deadline_at)
                              : recommendation.deadline_label}
                          </dd>
                        </div>
                      </dl>
                      <ul className={styles.reasonTagList} aria-label="おすすめ理由">
                        {recommendation.reason_tags.map((tag) => (
                          <li key={tag}>{tag}</li>
                        ))}
                      </ul>
                    </>
                  ) : (
                    <PremiumPreview
                      placeholders={[
                        { label: "次の行動", value: "具体的な行動を提案します" },
                        { label: "見直しタイミング", value: "最適なタイミングを表示" }
                      ]}
                      message="次の行動と見直しタイミングを確認"
                      page="/decisions"
                      source="recommendation_card_preview"
                    />
                  )}
                  <p className={styles.episodeLinkText}>詳細を見る</p>
                </TrackedLink>
              </article>
            ))}
          </div>
        )}

        <div className={styles.allLinkPanel}>
          <div>
            <p className={styles.sectionEyebrow}>一覧</p>
            <h3>すべての判断は一覧画面でまとめて確認できます</h3>
            <p className={styles.sectionCaption}>
              今日のおすすめに絞って判断したあと、必要なときだけ全件一覧へ進めます。
            </p>
          </div>
          <TrackedLink
            href="/decisions/all"
            className={styles.inlineUpgradeLink}
            eventName="nav_click"
            eventProperties={{
              page: "/decisions",
              source: "decision_dashboard_all_link",
              destination: "/decisions/all"
            }}
          >
            すべての判断を見る
          </TrackedLink>
        </div>

        {!isPaid ? (
          <div className={styles.recommendationFootnote}>
            <p className={styles.sectionEyebrow}>プラン</p>
            <h3>有料版では判断理由と次の行動まで見えます</h3>
            <p>無料版はタイトルとかんたんな説明まで。有料版で見直しタイミングと履歴分析も確認できます。</p>
            <TrackedLink
              href="/account"
              className={styles.inlineUpgradeLink}
              eventName="subscribe_cta_click"
              eventProperties={{
                page: "/decisions",
                source: "next_best_decision_upgrade"
              }}
            >
              プランを見る
            </TrackedLink>
          </div>
        ) : null}
      </section>

      {error ? <p className={styles.errorText}>判断カードの読み込みに失敗しました。時間をおいて再度お試しください。</p> : null}

      {!isPaid ? (
        <section className={styles.paywallBanner}>
          <div>
            <p className={styles.paywallEyebrow}>無料版</p>
            <h2>無料版はタイトルとかんたんな説明までです</h2>
            <p>
              有料版にすると、判断理由、次の行動、見直しタイミング、履歴分析までまとめて確認できます。
            </p>
          </div>
          <TrackedLink
            href="/account"
            className={styles.paywallLink}
            eventName="subscribe_cta_click"
            eventProperties={{
              page: "/decisions",
              source: "decision_dashboard_paywall_banner"
            }}
          >
            プランを見る
          </TrackedLink>
        </section>
      ) : null}
    </main>
  );
}
