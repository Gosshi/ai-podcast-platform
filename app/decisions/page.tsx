import AlertsInbox from "@/app/components/AlertsInbox";
import AnalyticsEventOnRender from "@/app/components/AnalyticsEventOnRender";
import AnalyticsPageView from "@/app/components/AnalyticsPageView";
import MemberControls from "@/app/components/MemberControls";
import OutcomeReminderSection from "@/app/components/OutcomeReminderSection";
import SaveDecisionButton from "@/app/components/SaveDecisionButton";
import TrackedLink from "@/app/components/TrackedLink";
import WatchlistControls from "@/app/components/WatchlistControls";
import { syncUserAlerts } from "@/app/lib/alerts";
import { loadDecisionDashboardCards } from "@/app/lib/decisions";
import { loadDecisionHistory } from "@/app/lib/decisionHistory";
import { formatThresholdHighlights } from "@/app/lib/judgmentAccess";
import { buildOnboardingPath } from "@/app/lib/onboarding";
import { getViewerFromCookies } from "@/app/lib/viewer";
import { groupDecisionDashboardCards, pickTodayDecisionCards } from "@/src/lib/decisionDashboard";
import { buildPersonalDecisionHint } from "@/src/lib/decisionProfile";
import { rankNextBestDecisions } from "@/src/lib/nextBestDecision";
import { buildOutcomeReminderCandidates, limitOutcomeReminderCandidates } from "@/src/lib/outcomeReminder";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

const JUDGMENT_TYPE_LABELS = {
  use_now: "使う",
  watch: "監視",
  skip: "見送り"
} as const;

const JUDGMENT_TYPE_DESCRIPTIONS = {
  use_now: "今日すぐ使う候補",
  watch: "条件変化を監視する候補",
  skip: "今は見送る候補"
} as const;

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
  const isPaid = viewer?.isPaid ?? false;
  const onboardingPath = buildOnboardingPath("/decisions");

  const [{ cards, error }, historyState, alertState] = await Promise.all([
    loadDecisionDashboardCards({ isPaid, userId: viewer?.userId }),
    viewer?.userId
      ? loadDecisionHistory(viewer.userId)
      : Promise.resolve({
          entries: [],
          stats: {
            totalDecisions: 0,
            resolvedCount: 0,
            unresolvedCount: 0,
            successCount: 0,
            regretCount: 0,
            neutralCount: 0,
            successRate: 0
          },
          profile: null,
          error: null
        }),
    viewer ? syncUserAlerts(viewer) : Promise.resolve({ alerts: [], preferences: null, error: null })
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
  const todayCards = pickTodayDecisionCards(cards);
  const groupedCards = groupDecisionDashboardCards(cards);
  const todayLabel = formatDecisionDate(todayCards[0]?.episode_published_at ?? null);

  const renderDecisionCard = (
    card: (typeof cards)[number],
    secondaryMetaLabel: string,
    secondaryMetaValue: string
  ) => {
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
          href={`/episodes/${card.episode_id}`}
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
            <span className={styles.genreTag}>{card.genre ?? "general"}</span>
          </div>
          <h3>{card.topic_title}</h3>
          <p className={styles.summary}>{card.judgment_summary}</p>
          {personalHint ? (
            <div className={`${styles.personalHint} ${styles[`personalHint_${personalHint.tone}`]}`.trim()}>
              <span className={styles.personalHintLabel}>あなた向けの補足</span>
              <p>{personalHint.text}</p>
            </div>
          ) : null}
          <dl className={styles.metaList}>
            {isPaid && card.action_text ? (
              <div>
                <dt>次の行動</dt>
                <dd>{card.action_text}</dd>
              </div>
            ) : null}
            {isPaid && card.deadline_at ? (
              <div>
                <dt>期限</dt>
                <dd>{formatDeadline(card.deadline_at)}</dd>
              </div>
            ) : null}
            <div>
              <dt>{secondaryMetaLabel}</dt>
              <dd>{secondaryMetaValue}</dd>
            </div>
          </dl>
          {isPaid && card.watch_points.length > 0 ? (
            <ul className={styles.detailList}>
              {card.watch_points.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          ) : null}
          {isPaid && formatThresholdHighlights(card.threshold_json).length > 0 ? (
            <ul className={styles.detailList}>
              {formatThresholdHighlights(card.threshold_json).map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : null}
        </TrackedLink>
        {!isPaid ? (
          <div className={styles.lockedPanel}>
            <strong>この先は有料プラン向け</strong>
            <p>次の行動、期限、監視ポイント、判断基準まで確認できます。</p>
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
          eventName="decisions_hero_impression"
          properties={{
            page: "/decisions",
            source: "decisions_hero",
            is_paid: isPaid,
            needs_onboarding: Boolean(viewer?.needsOnboarding)
          }}
        />
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>Decisions</p>
          <h1>今日のおすすめから、そのまま見始められます。</h1>
          <p className={styles.lead}>
            まず見るべき作品、少し様子を見たい候補、今回は見送ってよい候補を、短い判断メモでまとめています。
          </p>
          <div className={styles.heroMeta}>
            <span className={styles.heroBadge}>{isPaid ? "有料プラン" : "無料プラン"}</span>
            <span>{isPaid ? "詳しい理由や次の一手まで確認できます" : "まずは要点だけ軽く確認できます"}</span>
          </div>
          <div className={styles.heroActions}>
            {viewer?.needsOnboarding ? (
              <TrackedLink
                href={onboardingPath}
                className={styles.secondaryHeroLink}
                eventName="nav_click"
                eventProperties={{
                  page: "/decisions",
                  source: "decisions_hero_onboarding",
                  destination: onboardingPath
                }}
                additionalEvents={[
                  {
                    eventName: "onboarding_entry_click",
                    eventProperties: {
                      page: "/decisions",
                      source: "decisions_hero",
                      destination: onboardingPath
                    }
                  }
                ]}
              >
                好みを設定する
              </TrackedLink>
            ) : null}
            <TrackedLink
              href="/decisions/library"
              className={styles.heroLink}
              eventName="library_card_click"
              eventProperties={{
                page: "/decisions",
                source: "decision_dashboard_hero_library_link"
              }}
            >
              ライブラリを見る
            </TrackedLink>
          </div>
        </div>

        <MemberControls
          viewer={viewer}
          title="プラン"
          copy="無料版は要点まで、有料版は詳しい判断メモまで確認できます。"
          analyticsSource="/decisions"
          variant="compact"
        />
      </section>

      {viewer?.needsOnboarding ? (
        <section className={styles.onboardingPrompt}>
          <div>
            <p className={styles.sectionEyebrow}>Setup</p>
            <h2>好みを先に入れておくと、おすすめが安定します。</h2>
            <p className={styles.sectionCaption}>
              よく見るジャンルや使っているサービスを数問で設定すると、今日のおすすめがあなた向けに整います。
            </p>
          </div>
          <TrackedLink
            href={onboardingPath}
            className={styles.heroLink}
            eventName="nav_click"
            eventProperties={{
              page: "/decisions",
              source: "decisions_onboarding_prompt",
              destination: onboardingPath
            }}
            additionalEvents={[
              {
                eventName: "onboarding_entry_click",
                eventProperties: {
                  page: "/decisions",
                  source: "decisions_prompt",
                  destination: onboardingPath
                }
              }
            ]}
          >
            1分で設定する
          </TrackedLink>
        </section>
      ) : null}

      <section className={styles.recommendationSection}>
        <div className={styles.recommendationHeader}>
          <div>
            <p className={styles.sectionEyebrow}>Today&apos;s Pick</p>
            <h2>{isPaid ? "今日のおすすめ" : "まず見ておきたい判断"}</h2>
            <p className={styles.sectionCaption}>
              {isPaid
                ? "期限やあなたの過去の傾向を踏まえて、先に見ておきたい候補を並べています。"
                : "まず見る優先度が高い候補を、分かりやすい順で並べています。"}
            </p>
          </div>
          <div className={styles.countRow}>
            <span>{isPaid ? `${nextBestDecisions.length}件を表示` : "無料版のおすすめ"}</span>
          </div>
        </div>

        {nextBestDecisions.length === 0 ? (
          <p className={styles.emptyText}>今すぐおすすめできる判断メモはまだありません。</p>
        ) : (
          <div className={styles.recommendationGrid}>
            {nextBestDecisions.map((recommendation) => (
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
                  href={`/episodes/${recommendation.card.episode_id}`}
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
                    <span className={styles.genreTag}>{recommendation.card.genre ?? "general"}</span>
                    <span className={styles.recommendationEpisodeLabel}>
                      {recommendation.card.episode_title ?? "Untitled episode"}
                    </span>
                  </div>
                  <h3>{recommendation.card.topic_title}</h3>
                  <p className={styles.summary}>{recommendation.card.judgment_summary}</p>
                  <dl className={styles.metaList}>
                    <div>
                      <dt>次にすると良いこと</dt>
                      <dd>{recommendation.recommended_action}</dd>
                    </div>
                    <div>
                      <dt>見直しタイミング</dt>
                      <dd>
                        {isPaid && recommendation.card.deadline_at
                          ? formatDeadline(recommendation.card.deadline_at)
                          : recommendation.deadline_label}
                      </dd>
                    </div>
                  </dl>
                  <ul className={styles.reasonTagList}>
                    {recommendation.reason_tags.map((tag) => (
                      <li key={tag}>{tag}</li>
                    ))}
                  </ul>
                  <p className={styles.episodeLinkText}>エピソードを見る</p>
                </TrackedLink>
              </article>
            ))}
          </div>
        )}

        {!isPaid ? (
          <div className={styles.recommendationFootnote}>
            <p className={styles.sectionEyebrow}>Upgrade</p>
            <h3>有料版では「なぜこの候補を出したか」まで見えます</h3>
            <p>見直しタイミングやあなたの傾向まで含めて、より納得しやすいおすすめに広がります。</p>
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

      {error ? <p className={styles.errorText}>判断メモの読み込みに失敗しました: {error}</p> : null}
      {alertState.error ? <p className={styles.errorText}>お知らせの同期に失敗しました: {alertState.error}</p> : null}

      {!isPaid ? (
        <section className={styles.paywallBanner}>
          <div>
            <p className={styles.paywallEyebrow}>Free Preview</p>
            <h2>詳しい判断メモは Account から切り替えできます</h2>
            <p>
              無料版はまず要点を確認するための入口です。有料版にすると、次の一手や見直しタイミングまでまとめて見られます。
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

      {viewer ? (
        <AlertsInbox
          alerts={alertState.alerts.slice(0, 3)}
          page="/decisions"
          title="見直したい項目"
          lead="期限が近いものや、あとで見たい候補をここからすぐ開き直せます。"
          showViewAllLink={alertState.alerts.length > 3}
        />
      ) : null}

      {viewer && visibleOutcomeReminders.length > 0 ? (
        <OutcomeReminderSection
          reminders={visibleOutcomeReminders}
          hiddenCount={hiddenOutcomeReminderCount}
          isPaid={isPaid}
          page="/decisions"
        />
      ) : null}

      <section className={styles.section}>
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.sectionEyebrow}>Today</p>
            <h2>今日の判断</h2>
            <p className={styles.sectionCaption}>{todayLabel}</p>
          </div>
          <div className={styles.countRow}>
            <span>{JUDGMENT_TYPE_LABELS.use_now} {groupedCards.use_now.length}件</span>
            <span>{JUDGMENT_TYPE_LABELS.watch} {groupedCards.watch.length}件</span>
            <span>{JUDGMENT_TYPE_LABELS.skip} {groupedCards.skip.length}件</span>
          </div>
        </div>

        {todayCards.length === 0 ? (
          <p className={styles.emptyText}>判断メモはまだありません。</p>
        ) : (
          <div className={styles.grid}>
            {todayCards.map((card) => renderDecisionCard(card, "元エピソード", card.episode_title ?? "Untitled episode"))}
          </div>
        )}
      </section>

      {(["use_now", "watch", "skip"] as const).map((judgmentType) => {
        const sectionCards = groupedCards[judgmentType];

        return (
          <section key={judgmentType} className={styles.section}>
            <div className={styles.sectionHeading}>
              <div>
                <p className={styles.sectionEyebrow}>{JUDGMENT_TYPE_DESCRIPTIONS[judgmentType]}</p>
                <h2>{JUDGMENT_TYPE_LABELS[judgmentType]}</h2>
              </div>
              <span className={styles.sectionCount}>{sectionCards.length}件</span>
            </div>

            {sectionCards.length === 0 ? (
              <p className={styles.emptyText}>この分類の判断はまだありません。</p>
            ) : (
              <div className={styles.grid}>
                {sectionCards.map((card) =>
                  renderDecisionCard(card, "公開日", formatDecisionDate(card.episode_published_at))
                )}
              </div>
            )}
          </section>
        );
      })}
    </main>
  );
}
