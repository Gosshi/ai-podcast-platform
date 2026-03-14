import Link from "next/link";
import AnalyticsEventOnRender from "@/app/components/AnalyticsEventOnRender";
import AnalyticsPageView from "@/app/components/AnalyticsPageView";
import MemberControls from "@/app/components/MemberControls";
import SaveDecisionButton from "@/app/components/SaveDecisionButton";
import TrackedLink from "@/app/components/TrackedLink";
import WatchlistControls from "@/app/components/WatchlistControls";
import { buildOnboardingPath } from "@/app/lib/onboarding";
import { buildDecisionReplayPath } from "@/app/lib/decisionReplay";
import {
  DEFAULT_DECISION_LIBRARY_SORT,
  FREE_LIBRARY_CARD_LIMIT,
  loadDecisionLibrary
} from "@/app/lib/decisionLibrary";
import { formatEpisodeTitle, formatFrameTypeLabel, formatTopicTitle, JUDGMENT_TYPE_LABELS, URGENCY_LABELS } from "@/app/lib/uiText";
import { getViewerFromCookies } from "@/app/lib/viewer";
import {
  DECISION_LIBRARY_SORTS,
  DECISION_LIBRARY_URGENCIES,
  resolveDecisionLibraryDefaultSort,
  type DecisionLibrarySort,
  type DecisionLibraryUrgency
} from "@/src/lib/decisionLibrary";
import type { JudgmentType } from "@/src/lib/judgmentCards";
import { ACTIVE_SUBSCRIPTION_LABELS, DECISION_PRIORITY_LABELS, INTEREST_TOPIC_LABELS } from "@/src/lib/userPreferences";
import LibraryControls from "./LibraryControls";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

const toSingleValue = (value: string | string[] | undefined): string => {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
};

const isJudgmentType = (value: string): value is JudgmentType => {
  return value === "use_now" || value === "watch" || value === "skip";
};

const isDecisionLibraryUrgency = (value: string): value is DecisionLibraryUrgency => {
  return DECISION_LIBRARY_URGENCIES.includes(value as DecisionLibraryUrgency);
};

const isDecisionLibrarySort = (value: string): value is DecisionLibrarySort => {
  return DECISION_LIBRARY_SORTS.includes(value as DecisionLibrarySort);
};

const formatDate = (value: string | null, fallback = "-"): string => {
  if (!value) return fallback;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
};

const formatDeadline = (value: string | null): string => {
  if (!value) return "期限未設定";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("ja-JP", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
};

const buildPageHref = (
  filters: {
    query: string;
    genre: string | null;
    frameType: string | null;
    judgmentType: JudgmentType | null;
    urgency: DecisionLibraryUrgency | null;
    sort: DecisionLibrarySort;
  },
  page: number
): string => {
  const params = new URLSearchParams();

  if (filters.query) params.set("q", filters.query);
  if (filters.genre) params.set("genre", filters.genre);
  if (filters.frameType) params.set("frame", filters.frameType);
  if (filters.judgmentType) params.set("judgment", filters.judgmentType);
  if (filters.urgency) params.set("urgency", filters.urgency);
  if (filters.sort !== DEFAULT_DECISION_LIBRARY_SORT) params.set("sort", filters.sort);
  if (page > 1) params.set("page", String(page));

  const queryString = params.toString();
  return queryString ? `/decisions/library?${queryString}` : "/decisions/library";
};

export default async function DecisionLibraryPage({
  searchParams
}: {
  searchParams?: Promise<SearchParams> | SearchParams;
}) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const viewer = await getViewerFromCookies();
  const onboardingPath = buildOnboardingPath("/decisions/library");

  const query = toSingleValue(resolvedSearchParams.q).trim().replace(/\s+/g, " ");
  const genre = toSingleValue(resolvedSearchParams.genre).trim() || null;
  const frameType = toSingleValue(resolvedSearchParams.frame).trim() || null;
  const judgmentParam = toSingleValue(resolvedSearchParams.judgment).trim();
  const urgencyParam = toSingleValue(resolvedSearchParams.urgency).trim();
  const sortParam = toSingleValue(resolvedSearchParams.sort).trim();
  const pageParam = Number.parseInt(toSingleValue(resolvedSearchParams.page), 10);
  const judgmentType = isJudgmentType(judgmentParam) ? judgmentParam : null;
  const urgency = isDecisionLibraryUrgency(urgencyParam) ? urgencyParam : null;
  const explicitSort = isDecisionLibrarySort(sortParam) ? sortParam : null;
  const hasExplicitSort = Boolean(explicitSort);
  const defaultSort = resolveDecisionLibraryDefaultSort(viewer?.preferenceProfile);
  const sort = explicitSort ?? defaultSort;
  const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;
  const isPaid = viewer?.isPaid ?? false;
  const isInitialView = !query && !genre && !frameType && !judgmentType && !urgency && page === 1;

  const activeFilters = {
    query,
    genre,
    frameType,
    judgmentType,
    urgency,
    sort
  };

  const result = await loadDecisionLibrary({
    isPaid,
    userId: viewer?.userId,
    preferenceProfile: !hasExplicitSort && isInitialView ? viewer?.preferenceProfile : null,
    query,
    genre,
    frameType,
    judgmentType,
    urgency,
    sort,
    page
  });

  return (
    <main className={styles.page}>
      <AnalyticsPageView
        page="/decisions/library"
        pageEventName="library_view"
        extraProperties={{
          sort,
          personalized_initial_view: Boolean(result.personalization && !hasExplicitSort && isInitialView)
        }}
      />
      {result.personalization && !hasExplicitSort && isInitialView ? (
        <AnalyticsEventOnRender
          eventName="library_pref_personalized_impression"
          properties={{
            page: "/decisions/library",
            source: "decision_library_personalized_hero",
            sort,
            decision_priority: result.personalization.decisionPriority,
            interest_topics: result.personalization.interestTopics,
            active_subscriptions: result.personalization.activeSubscriptions
          }}
        />
      ) : null}

      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>保存</p>
          <h1>あとで見返したい判断メモを、まとめて探せます。</h1>
          <p className={styles.lead}>
            ジャンル、見直しタイミング、見送るかどうかといった軸で、過去の判断メモを一覧できます。気になった候補の
            再訪や比較に使う画面です。
          </p>

          <div className={styles.heroMeta}>
            <span className={styles.heroBadge}>{isPaid ? "有料プラン" : "無料プラン"}</span>
            <span>{isPaid ? `全${result.totalCount}件を検索` : `直近カードを最大${FREE_LIBRARY_CARD_LIMIT}件まで表示`}</span>
            <span>{query ? `検索中: ${query}` : "すべて表示"}</span>
          </div>

          <div className={styles.statRow}>
            <div className={styles.statCard}>
              <span className={styles.statLabel}>表示中</span>
              <strong>{result.cards.length}</strong>
            </div>
            <div className={styles.statCard}>
              <span className={styles.statLabel}>一致件数</span>
              <strong>{result.totalCount}</strong>
            </div>
            <div className={styles.statCard}>
              <span className={styles.statLabel}>表示範囲</span>
              <strong>{isPaid ? "全件" : "最近の一部"}</strong>
            </div>
          </div>

          {viewer?.needsOnboarding ? (
            <div className={styles.personalizationPanel}>
              <p className={styles.sectionEyebrow}>初回設定</p>
              <h2>好みを入れておくと、最初の並び順が分かりやすくなります。</h2>
              <p className={styles.personalizationLead}>
                よく見るジャンルや使っているサービスを入れると、最初に見たい候補が上に出やすくなります。
              </p>
              <TrackedLink
                href={onboardingPath}
                className={styles.primaryLink}
                eventName="nav_click"
                eventProperties={{
                  page: "/decisions/library",
                  source: "library_onboarding_prompt",
                  destination: onboardingPath
                }}
                additionalEvents={[
                  {
                    eventName: "onboarding_entry_click",
                    eventProperties: {
                      page: "/decisions/library",
                      source: "library_prompt",
                      destination: onboardingPath
                    }
                  }
                ]}
              >
                好みを設定する
              </TrackedLink>
            </div>
          ) : null}

          {result.personalization && !hasExplicitSort && isInitialView ? (
            <div className={styles.personalizationPanel}>
              <p className={styles.sectionEyebrow}>おすすめ順</p>
              <h2>最初の並びはあなたの好みを少し反映しています</h2>
              <p className={styles.personalizationLead}>
                {result.personalization.interestTopics.length > 0
                  ? `${result.personalization.interestTopics
                      .slice(0, 2)
                      .map((topic) => INTEREST_TOPIC_LABELS[topic])
                      .join(" / ")} 系を少し上位にしています。`
                  : "好みに近いカードを少し上位にしています。"}{" "}
                {result.personalization.activeSubscriptions.length > 0
                  ? `${result.personalization.activeSubscriptions
                      .slice(0, 2)
                      .map((subscription) => ACTIVE_SUBSCRIPTION_LABELS[subscription])
                      .join(" / ")} 関連も補正しています。`
                  : ""}
              </p>
              <div className={styles.personalizationMeta}>
                <span className={styles.personalizationChip}>
                  重視すること: {DECISION_PRIORITY_LABELS[result.personalization.decisionPriority]}
                </span>
                <span className={styles.personalizationChip}>並び順: {result.personalization.defaultSort}</span>
              </div>
            </div>
          ) : null}
        </div>

        <MemberControls
          viewer={viewer}
          title="プラン"
          copy="無料版は最近の要点まで、有料版は全件検索と詳しい見直しまで使えます。"
          analyticsSource="/decisions/library"
          variant="compact"
        />
      </section>

      <LibraryControls initialFilters={activeFilters} defaultSort={defaultSort} options={result.options} isPaid={isPaid} />

      {result.error ? <p className={styles.errorText}>ライブラリの読み込みに失敗しました: {result.error}</p> : null}

      {!isPaid && result.previewLimited ? (
        <section className={styles.noticePanel}>
          <div>
            <p className={styles.sectionEyebrow}>表示上限</p>
            <h2>無料版は最近の判断メモを一部だけ表示します</h2>
            <p>
              {result.searchPreviewLimited
                ? `現在の検索結果は ${result.totalCount} 件ありますが、無料版では最初の ${result.cards.length} 件だけ表示します。`
                : `現在の一致件数は ${result.totalCount} 件です。無料版では直近カードを最大 ${FREE_LIBRARY_CARD_LIMIT} 件まで表示します。`}
            </p>
          </div>
          <TrackedLink
            href="/account"
            className={styles.primaryLink}
            eventName="subscribe_cta_click"
            eventProperties={{
              page: "/decisions/library",
              source: "decision_library_preview_limit"
            }}
          >
            プランを見る
          </TrackedLink>
        </section>
      ) : null}

      <section className={styles.section}>
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.sectionEyebrow}>検索結果</p>
            <h2>検索して見返せる判断メモ</h2>
            <p className={styles.sectionLead}>
              エピソード一覧から探し直さなくても、判断の内容から見返せます。
            </p>
          </div>
          <span className={styles.sectionCount}>
            {isPaid && result.totalPages > 1
              ? `${result.currentPage} / ${result.totalPages} page`
              : `${result.cards.length} cards`}
          </span>
        </div>

        {result.cards.length === 0 ? (
          <p className={styles.emptyText}>条件に一致する judgment card はありません。</p>
        ) : (
          <div className={styles.grid}>
            {result.cards.map((card) => (
              <article key={card.id} className={styles.card}>
                <div className={styles.cardHeader}>
              <div className={styles.badgeRow}>
                <span className={`${styles.badge} ${styles[`badge_${card.judgment_type}`]}`.trim()}>
                      {JUDGMENT_TYPE_LABELS[card.judgment_type]}
                    </span>
                    <span className={`${styles.badge} ${styles[`urgency_${card.urgency}`]}`.trim()}>
                      {URGENCY_LABELS[card.urgency]}
                    </span>
                  </div>
                  <div className={styles.tagRow}>
                    <span className={styles.tag}>{card.genre ?? "配信作品"}</span>
                    <span className={styles.tag}>{formatFrameTypeLabel(card.frame_type, "判断タイプ未設定")}</span>
                    {card.is_saved ? <span className={styles.tag}>履歴あり</span> : null}
                    {card.watchlist_status ? <span className={styles.tag}>{card.watchlist_status}</span> : null}
                  </div>
                </div>

                <h3>{formatTopicTitle(card.topic_title)}</h3>
                <p className={styles.summary}>{card.judgment_summary}</p>

                {card.personalization_reasons.length > 0 && result.personalization ? (
                  <div className={styles.personalReasonRow}>
                    {card.personalization_reasons.map((reason) => (
                      <span key={`${card.id}:${reason}`} className={styles.personalReasonChip}>
                        {reason}
                      </span>
                    ))}
                  </div>
                ) : null}

                <dl className={styles.metaList}>
                  <div>
                    <dt>公開日</dt>
                    <dd>{formatDate(card.episode_published_at ?? card.created_at)}</dd>
                  </div>
                  <div>
                    <dt>期限</dt>
                    <dd>{isPaid ? formatDeadline(card.deadline_at) : "有料会員で表示"}</dd>
                  </div>
                  <div>
                    <dt>詳細</dt>
                    <dd>{formatEpisodeTitle(card.episode_title)}</dd>
                  </div>
                </dl>

                {isPaid && card.action_text ? (
                  <div className={styles.detailBlock}>
                    <span className={styles.detailLabel}>次にすると良いこと</span>
                    <p>{card.action_text}</p>
                  </div>
                ) : null}

                {isPaid && card.watch_points.length > 0 ? (
                  <div className={styles.detailBlock}>
                    <span className={styles.detailLabel}>見直しポイント</span>
                    <ul className={styles.detailList}>
                      {card.watch_points.map((point) => (
                        <li key={point}>{point}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {!isPaid ? (
                  <div className={styles.lockedPanel}>
                    <strong>詳しい見直し情報は有料会員向けです</strong>
                    <p>無料版は要点まで、有料版では次にすると良いことや期限も確認できます。</p>
                  </div>
                ) : null}

                <div className={styles.cardFooter}>
                  <div className={styles.cardActionStack}>
                    <WatchlistControls
                      judgmentCardId={card.id}
                      viewer={viewer}
                      initialItemId={card.watchlist_item_id}
                      initialStatus={card.watchlist_status}
                      page="/decisions/library"
                      source="decision_library_card"
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
                      page="/decisions/library"
                      source="decision_library_card"
                      episodeId={card.episode_id}
                      genre={card.genre}
                      frameType={card.frame_type}
                      judgmentType={card.judgment_type}
                    />
                  </div>
                  <div className={styles.linkRow}>
                    <TrackedLink
                      href={`/episodes/${card.episode_id}`}
                      className={styles.cardLink}
                      eventName="library_card_click"
                      eventProperties={{
                        page: "/decisions/library",
                        source: "decision_library_episode_link",
                        episode_id: card.episode_id,
                        judgment_card_id: card.id,
                        genre: card.genre ?? undefined,
                        frame_type: card.frame_type ?? undefined,
                        judgment_type: card.judgment_type,
                        urgency: card.urgency,
                        query: activeFilters.query || undefined,
                        sort: activeFilters.sort
                      }}
                    >
                      詳細
                    </TrackedLink>
                    <TrackedLink
                      href="/history"
                      className={styles.secondaryLink}
                      eventName="library_card_click"
                      eventProperties={{
                        page: "/decisions/library",
                        source: "decision_library_history_link",
                        episode_id: card.episode_id,
                        judgment_card_id: card.id,
                        genre: card.genre ?? undefined,
                        frame_type: card.frame_type ?? undefined,
                        judgment_type: card.judgment_type,
                        urgency: card.urgency,
                        query: activeFilters.query || undefined,
                        sort: activeFilters.sort
                      }}
                    >
                      履歴
                    </TrackedLink>
                    {card.saved_decision_id ? (
                      <TrackedLink
                        href={buildDecisionReplayPath(card.saved_decision_id)}
                        className={styles.secondaryLink}
                        eventName="library_card_click"
                        eventProperties={{
                          page: "/decisions/library",
                          source: "decision_library_replay_link",
                          episode_id: card.episode_id,
                          judgment_card_id: card.id,
                          decision_id: card.saved_decision_id,
                          genre: card.genre ?? undefined,
                          frame_type: card.frame_type ?? undefined,
                          judgment_type: card.judgment_type,
                          urgency: card.urgency,
                          query: activeFilters.query || undefined,
                          sort: activeFilters.sort
                        }}
                      >
                        振り返り
                      </TrackedLink>
                    ) : null}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}

        {isPaid && result.totalPages > 1 ? (
          <div className={styles.pagination}>
            {result.currentPage > 1 ? (
              <Link className={styles.secondaryLink} href={buildPageHref(activeFilters, result.currentPage - 1)}>
                前へ
              </Link>
            ) : (
              <span className={styles.paginationGhost} />
            )}
            <span className={styles.paginationLabel}>
              Page {result.currentPage} / {result.totalPages}
              
            </span>
            {result.currentPage < result.totalPages ? (
              <Link className={styles.secondaryLink} href={buildPageHref(activeFilters, result.currentPage + 1)}>
                次へ
              </Link>
            ) : (
              <span className={styles.paginationGhost} />
            )}
          </div>
        ) : null}
      </section>
    </main>
  );
}
