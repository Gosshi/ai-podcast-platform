import { redirect } from "next/navigation";
import AlertsInbox from "@/app/components/AlertsInbox";
import AnalyticsEventOnRender from "@/app/components/AnalyticsEventOnRender";
import AnalyticsPageView from "@/app/components/AnalyticsPageView";
import OutcomeReminderSection from "@/app/components/OutcomeReminderSection";
import SaveDecisionButton from "@/app/components/SaveDecisionButton";
import TrackedLink from "@/app/components/TrackedLink";
import WatchlistControls from "@/app/components/WatchlistControls";
import { resolveAlertsErrorMessage, syncUserAlerts } from "@/app/lib/alerts";
import { loadDecisionDashboardCards } from "@/app/lib/decisions";
import { loadDecisionHistory } from "@/app/lib/decisionHistory";
import { buildLoginPath, buildOnboardingPath } from "@/app/lib/onboarding";
import { formatEpisodeTitle, formatGenreLabel, formatTopicTitle, JUDGMENT_TYPE_LABELS } from "@/app/lib/uiText";
import { getViewerFromCookies } from "@/app/lib/viewer";
import { pickTodayDecisionCards } from "@/src/lib/decisionDashboard";
import { buildPersonalDecisionHint } from "@/src/lib/decisionProfile";
import { rankNextBestDecisions } from "@/src/lib/nextBestDecision";
import { buildOutcomeReminderCandidates, limitOutcomeReminderCandidates } from "@/src/lib/outcomeReminder";
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

const formatDecisionDate = (value: string | null): string => {
  if (!value) return "公開日未設定";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric"
  });
};

export default async function DecisionsPage() {
  const viewer = await getViewerFromCookies();
  if (!viewer) {
    redirect(buildLoginPath("/decisions"));
  }

  const isPaid = viewer?.isPaid ?? false;
  const onboardingPath = buildOnboardingPath("/decisions");
  const onboardingEntryHref = onboardingPath;

  const [{ cards, error }, historyState, alertState] = await Promise.all([
    loadDecisionDashboardCards({ isPaid, userId: viewer?.userId }),
    loadDecisionHistory(viewer.userId),
    syncUserAlerts(viewer)
  ]);

  const personalProfile = viewer?.isPaid ? historyState.profile : null;
  const allOutcomeReminders = buildOutcomeReminderCandidates(historyState.entries);
  const visibleOutcomeReminders = limitOutcomeReminderCandidates(allOutcomeReminders, isPaid);
  const hiddenOutcomeReminderCount = Math.max(allOutcomeReminders.length - visibleOutcomeReminders.length, 0);
  const nextBestDecisions = rankNextBestDecisions({
    cards,
    isPaid,
    profile: personalProfile,
    preferenceProfile: viewer?.preferenceProfile
  });
  const featuredDecisions = nextBestDecisions.slice(0, 3);
  const todayCards = pickTodayDecisionCards(cards);
  const allDecisionCards = todayCards.length > 0 ? todayCards : cards;
  const todayLabel = formatDecisionDate(allDecisionCards[0]?.episode_published_at ?? null);

  const renderDecisionCard = (card: (typeof cards)[number]) => {
    const personalHint = isPaid && personalProfile ? buildPersonalDecisionHint({ card, profile: personalProfile }) : null;

    return (
      <article key={card.id} className={styles.card}>
        <AnalyticsEventOnRender
          eventName="judgment_card_impression"
          properties={{
            page: "/decisions",
            source: "decision_dashboard_card",
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
            page: "/decisions",
            source: "decision_dashboard_card",
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
          {isPaid ? (
            <dl className={styles.metaList}>
              <div>
                <dt>判断理由</dt>
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
              <div>
                <dt>履歴からの補足</dt>
                <dd>{personalHint?.text ?? "履歴が増えるほど、あなた向けの補足が表示されます。"}</dd>
              </div>
            </dl>
          ) : null}
          {isPaid && personalHint ? (
            <div className={`${styles.personalHint} ${styles[`personalHint_${personalHint.tone}`]}`.trim()}>
              <span className={styles.personalHintLabel}>あなた向けの補足</span>
              <p>{personalHint.text}</p>
            </div>
          ) : null}
          <p className={styles.episodeLinkText}>詳細を見る</p>
        </TrackedLink>
        {!isPaid ? (
          <div className={styles.lockedPanel}>
            <strong>無料版はタイトルとかんたんな説明までです</strong>
            <p>有料版で判断理由、次の行動、見直しタイミング、履歴からの補足を確認できます。</p>
            <TrackedLink
              href="/account"
              className={styles.paywallLink}
              eventName="judgment_card_locked_cta_click"
              eventProperties={{
                page: "/decisions",
                source: "decision_dashboard_locked_panel",
                episode_id: card.episode_id,
                judgment_card_id: card.id,
                genre: card.genre ?? undefined,
                frame_type: card.frame_type ?? undefined,
                judgment_type: card.judgment_type
              }}
            >
              詳細を見る
            </TrackedLink>
          </div>
        ) : null}
        <div className={styles.cardActionRow}>
          <WatchlistControls
            judgmentCardId={card.id}
            viewer={viewer}
            initialItemId={card.watchlist_item_id}
            initialStatus={card.watchlist_status}
            page="/decisions"
            source="decision_dashboard_card"
            episodeId={card.episode_id}
            genre={card.genre}
            frameType={card.frame_type}
            judgmentType={card.judgment_type}
            compact
          />
          <SaveDecisionButton
            judgmentCardId={card.id}
            viewer={viewer}
            initialSaved={card.is_saved}
            page="/decisions"
            source="decision_dashboard_card"
            episodeId={card.episode_id}
            genre={card.genre}
            frameType={card.frame_type}
            judgmentType={card.judgment_type}
          />
        </div>
      </article>
    );
  };

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
              href="/saved"
              className={styles.heroLink}
              eventName="watchlist_card_click"
              eventProperties={{
                page: "/decisions",
                source: "decision_dashboard_hero_watchlist_link"
              }}
            >
              後で考える判断を見る
            </TrackedLink>
          </div>
        </div>
      </section>

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
                  ) : null}
                  <p className={styles.episodeLinkText}>詳細を見る</p>
                </TrackedLink>
              </article>
            ))}
          </div>
        )}

        <details className={styles.expandPanel}>
          <summary className={styles.expandSummary}>すべての判断を見る</summary>
          <div className={styles.expandContent}>
            <div className={styles.sectionHeading}>
              <div>
                <p className={styles.sectionEyebrow}>一覧</p>
                <h2>今日のおすすめ一覧</h2>
                <p className={styles.sectionCaption}>{todayLabel}</p>
              </div>
              <span className={styles.sectionCount}>{allDecisionCards.length}件</span>
            </div>

            {allDecisionCards.length === 0 ? (
              <p className={styles.emptyText}>判断カードはまだありません。</p>
            ) : (
              <div className={styles.grid}>{allDecisionCards.map((card) => renderDecisionCard(card))}</div>
            )}
          </div>
        </details>

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
      {alertState.error ? <p className={styles.errorText}>{resolveAlertsErrorMessage(alertState.error)}</p> : null}

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

      <AlertsInbox
        alerts={alertState.alerts.slice(0, 3)}
        page="/decisions"
        title="通知"
        lead="見直し時期が来たものだけを、必要な分だけまとめています。"
        showViewAllLink={alertState.alerts.length > 3}
      />

      {visibleOutcomeReminders.length > 0 ? (
        <OutcomeReminderSection
          reminders={visibleOutcomeReminders}
          hiddenCount={hiddenOutcomeReminderCount}
          isPaid={isPaid}
          page="/decisions"
        />
      ) : null}
    </main>
  );
}
