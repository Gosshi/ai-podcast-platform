import Link from "next/link";
import { redirect } from "next/navigation";
import AnalyticsPageView from "@/app/components/AnalyticsPageView";
import MemberControls from "@/app/components/MemberControls";
import TrackedLink from "@/app/components/TrackedLink";
import WatchlistControls from "@/app/components/WatchlistControls";
import { buildOnboardingPath } from "@/app/lib/onboarding";
import {
  DEFAULT_DECISION_LIBRARY_SORT,
  FREE_LIBRARY_CARD_LIMIT,
  loadDecisionLibrary
} from "@/app/lib/decisionLibrary";
import { getViewerFromCookies } from "@/app/lib/viewer";
import {
  DECISION_LIBRARY_SORTS,
  DECISION_LIBRARY_URGENCIES,
  type DecisionLibrarySort,
  type DecisionLibraryUrgency
} from "@/src/lib/decisionLibrary";
import type { JudgmentType } from "@/src/lib/judgmentCards";
import LibraryControls from "./LibraryControls";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

const JUDGMENT_LABELS: Record<JudgmentType, string> = {
  use_now: "使う",
  watch: "監視",
  skip: "見送り"
};

const URGENCY_LABELS: Record<DecisionLibraryUrgency, string> = {
  overdue: "Overdue",
  due_soon: "Due Soon",
  no_deadline: "No Deadline"
};

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

  if (viewer?.needsOnboarding) {
    redirect(buildOnboardingPath("/decisions/library"));
  }

  const query = toSingleValue(resolvedSearchParams.q).trim().replace(/\s+/g, " ");
  const genre = toSingleValue(resolvedSearchParams.genre).trim() || null;
  const frameType = toSingleValue(resolvedSearchParams.frame).trim() || null;
  const judgmentParam = toSingleValue(resolvedSearchParams.judgment).trim();
  const urgencyParam = toSingleValue(resolvedSearchParams.urgency).trim();
  const sortParam = toSingleValue(resolvedSearchParams.sort).trim();
  const pageParam = Number.parseInt(toSingleValue(resolvedSearchParams.page), 10);
  const judgmentType = isJudgmentType(judgmentParam) ? judgmentParam : null;
  const urgency = isDecisionLibraryUrgency(urgencyParam) ? urgencyParam : null;
  const sort = isDecisionLibrarySort(sortParam) ? sortParam : DEFAULT_DECISION_LIBRARY_SORT;
  const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;
  const isPaid = viewer?.isPaid ?? false;

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
      <AnalyticsPageView page="/decisions/library" pageEventName="library_view" />

      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>Decision Library</p>
          <h1>Judgment Cards を、検索・再訪・比較できる判断資産に変える。</h1>
          <p className={styles.lead}>
            `episode_judgment_cards` を横断して、topic / summary / frame / genre / urgency から判断を引き直せます。
            Replay、Saved Decisions、Alerts に接続するための library surface です。
          </p>

          <div className={styles.heroMeta}>
            <span className={styles.heroBadge}>{isPaid ? "PAID" : "FREE"}</span>
            <span>{isPaid ? `全${result.totalCount}件を検索` : `直近カードを最大${FREE_LIBRARY_CARD_LIMIT}件 preview`}</span>
            <span>{query ? `query: ${query}` : "query: all"}</span>
          </div>

          <div className={styles.statRow}>
            <div className={styles.statCard}>
              <span className={styles.statLabel}>Visible</span>
              <strong>{result.cards.length}</strong>
            </div>
            <div className={styles.statCard}>
              <span className={styles.statLabel}>Matched</span>
              <strong>{result.totalCount}</strong>
            </div>
            <div className={styles.statCard}>
              <span className={styles.statLabel}>Scope</span>
              <strong>{isPaid ? "Full Library" : "Recent Preview"}</strong>
            </div>
          </div>
        </div>

        <MemberControls
          viewer={viewer}
          title="Library Access"
          copy="free は最新カードの一部 preview と要約検索まで。paid は全件検索、deadline / action / watch points の再訪まで使えます。"
          analyticsSource="/decisions/library"
        />
      </section>

      <LibraryControls initialFilters={activeFilters} options={result.options} isPaid={isPaid} />

      {result.error ? <p className={styles.errorText}>decision library の読み込みに失敗しました: {result.error}</p> : null}

      {!isPaid && result.previewLimited ? (
        <section className={styles.noticePanel}>
          <div>
            <p className={styles.sectionEyebrow}>Preview Limit</p>
            <h2>free は最近のカードを一部だけ表示します</h2>
            <p>
              {result.searchPreviewLimited
                ? `現在の検索結果は ${result.totalCount} 件ありますが、free では最初の ${result.cards.length} 件だけ表示します。`
                : `現在の一致件数は ${result.totalCount} 件です。free では直近カードを最大 ${FREE_LIBRARY_CARD_LIMIT} 件まで表示します。`}
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
            Upgrade
          </TrackedLink>
        </section>
      ) : null}

      <section className={styles.section}>
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.sectionEyebrow}>Library Results</p>
            <h2>検索して再訪できる Judgment Cards</h2>
            <p className={styles.sectionLead}>
              episode を起点にせず、判断軸からカードを探して compare できます。
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
                      {JUDGMENT_LABELS[card.judgment_type]}
                    </span>
                    <span className={`${styles.badge} ${styles[`urgency_${card.urgency}`]}`.trim()}>
                      {URGENCY_LABELS[card.urgency]}
                    </span>
                  </div>
                  <div className={styles.tagRow}>
                    <span className={styles.tag}>{card.genre ?? "general"}</span>
                    <span className={styles.tag}>{card.frame_type ?? "frame unknown"}</span>
                  </div>
                </div>

                <h3>{card.topic_title}</h3>
                <p className={styles.summary}>{card.judgment_summary}</p>

                <dl className={styles.metaList}>
                  <div>
                    <dt>Created</dt>
                    <dd>{formatDate(card.episode_published_at ?? card.created_at)}</dd>
                  </div>
                  <div>
                    <dt>Deadline</dt>
                    <dd>{isPaid ? formatDeadline(card.deadline_at) : "有料会員で表示"}</dd>
                  </div>
                  <div>
                    <dt>Episode</dt>
                    <dd>{card.episode_title ?? "Untitled episode"}</dd>
                  </div>
                </dl>

                {isPaid && card.action_text ? (
                  <div className={styles.detailBlock}>
                    <span className={styles.detailLabel}>Next Action</span>
                    <p>{card.action_text}</p>
                  </div>
                ) : null}

                {isPaid && card.watch_points.length > 0 ? (
                  <div className={styles.detailBlock}>
                    <span className={styles.detailLabel}>Watch Points</span>
                    <ul className={styles.detailList}>
                      {card.watch_points.map((point) => (
                        <li key={point}>{point}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {!isPaid ? (
                  <div className={styles.lockedPanel}>
                    <strong>watch points / deadline / action は有料会員向け</strong>
                    <p>無料版は summary と最近の preview まで。再訪して使う library としては paid が完全版です。</p>
                  </div>
                ) : null}

                <div className={styles.cardFooter}>
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
                  <TrackedLink
                    href={`/episodes/${card.episode_id}`}
                    className={styles.cardLink}
                    eventName="library_card_click"
                    eventProperties={{
                      page: "/decisions/library",
                      source: "decision_library_card",
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
                    Episode を開く
                  </TrackedLink>
                </div>
              </article>
            ))}
          </div>
        )}

        {isPaid && result.totalPages > 1 ? (
          <div className={styles.pagination}>
            {result.currentPage > 1 ? (
              <Link className={styles.secondaryLink} href={buildPageHref(activeFilters, result.currentPage - 1)}>
                Previous
              </Link>
            ) : (
              <span className={styles.paginationGhost} />
            )}
            <span className={styles.paginationLabel}>
              Page {result.currentPage} / {result.totalPages}
            </span>
            {result.currentPage < result.totalPages ? (
              <Link className={styles.secondaryLink} href={buildPageHref(activeFilters, result.currentPage + 1)}>
                Next
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
