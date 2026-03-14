import AnalyticsPageView from "@/app/components/AnalyticsPageView";
import MemberControls from "@/app/components/MemberControls";
import TrackedLink from "@/app/components/TrackedLink";
import WatchlistControls from "@/app/components/WatchlistControls";
import { buildDecisionReplayPath } from "@/app/lib/decisionReplay";
import { getViewerFromCookies } from "@/app/lib/viewer";
import { loadUserWatchlist } from "@/app/lib/watchlist";
import {
  FREE_WATCHLIST_LIMIT,
  isWatchlistSort,
  isWatchlistStatus,
  isWatchlistUrgency,
  type WatchlistUrgency
} from "@/src/lib/watchlist";
import WatchlistFilters from "./WatchlistFilters";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

const JUDGMENT_LABELS = {
  use_now: "使う",
  watch: "監視",
  skip: "見送り"
} as const;

const STATUS_LABELS = {
  saved: "Saved",
  watching: "Watching",
  archived: "Archived"
} as const;

const URGENCY_LABELS: Record<WatchlistUrgency, string> = {
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

const formatDate = (value: string | null, withTime = false): string => {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("ja-JP", {
    year: "numeric",
    month: "short",
    day: "numeric",
    ...(withTime
      ? {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false
        }
      : {})
  });
};

export default async function WatchlistPage({
  searchParams
}: {
  searchParams?: Promise<SearchParams> | SearchParams;
}) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const viewer = await getViewerFromCookies();
  const isPaid = viewer?.isPaid ?? false;
  const statusParam = toSingleValue(resolvedSearchParams.status).trim();
  const genre = toSingleValue(resolvedSearchParams.genre).trim() || null;
  const frameType = toSingleValue(resolvedSearchParams.frame).trim() || null;
  const urgencyParam = toSingleValue(resolvedSearchParams.urgency).trim();
  const sortParam = toSingleValue(resolvedSearchParams.sort).trim();
  const status = isWatchlistStatus(statusParam) ? statusParam : null;
  const urgency = isPaid && isWatchlistUrgency(urgencyParam) ? urgencyParam : null;
  const sort = isWatchlistSort(sortParam)
    ? isPaid || sortParam !== "deadline_soon"
      ? sortParam
      : "newest"
    : "newest";

  const result = viewer
    ? await loadUserWatchlist({
        userId: viewer.userId,
        filters: {
          status,
          genre,
          frameType,
          urgency,
          sort
        }
      })
    : {
        items: [],
        options: {
          genres: [],
          frameTypes: []
        },
        error: null
      };

  const activeCount = result.items.filter((item) => item.status === "saved" || item.status === "watching").length;

  return (
    <main className={styles.page}>
      <AnalyticsPageView page="/watchlist" pageEventName="watchlist_view" />

      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>Saved Decisions / Watchlist</p>
          <h1>まだ決めていない判断を、期限と状態つきで管理する。</h1>
          <p className={styles.lead}>
            Decision History が「採用した判断」を記録するのに対して、Watchlist は「今は決めないが後で見返す判断」を残す面です。
            future alerts / replay / workflow へ返すための保留レイヤーとして使います。
          </p>

          <div className={styles.statRow}>
            <article className={styles.statCard}>
              <span className={styles.statLabel}>Active</span>
              <strong>{activeCount}</strong>
            </article>
            <article className={styles.statCard}>
              <span className={styles.statLabel}>Total</span>
              <strong>{result.items.length}</strong>
            </article>
            <article className={styles.statCard}>
              <span className={styles.statLabel}>Plan</span>
              <strong>{isPaid ? "PAID" : "FREE"}</strong>
            </article>
          </div>

          <p className={styles.limitText}>
            {viewer
              ? isPaid
                ? "paid は Watchlist を無制限で保持し、urgency / deadline まで再訪に使えます。"
                : `free は active item を最大${FREE_WATCHLIST_LIMIT}件まで保存できます。期限・urgency を本格活用する場合は paid へ切り替えてください。`
              : "ログインすると Judgment Card を Save / Watch して、ここで一覧管理できます。"}
          </p>
        </div>

        <MemberControls
          viewer={viewer}
          title="プラン"
          copy="迷った候補を残して、あとで見返しやすくします。"
          analyticsSource="/watchlist"
          variant="compact"
        />
      </section>

      {!viewer ? (
        <section className={styles.noticePanel}>
          <h2>Watchlist を使うにはログインが必要です</h2>
          <p>Judgment Card から Save / Watch すると、この画面で保留中の判断を一覧できます。</p>
          <TrackedLink
            href="/account"
            className={styles.primaryLink}
            eventName="subscribe_cta_click"
            eventProperties={{
              page: "/watchlist",
              source: "watchlist_login_notice"
            }}
          >
            Account でログイン
          </TrackedLink>
        </section>
      ) : null}

      {viewer ? (
        <WatchlistFilters
          initialFilters={{
            status,
            genre,
            frameType,
            urgency,
            sort
          }}
          options={result.options}
          isPaid={isPaid}
        />
      ) : null}

      {!isPaid && viewer ? (
        <section className={styles.noticePanel}>
          <h2>free は件数制限つき、paid は future workflow まで開放</h2>
          <p>無料版は簡易一覧と保存上限まで。有料会員になると deadline / urgency を使った再訪と将来の alerts 連携を前提に扱えます。</p>
          <TrackedLink
            href="/account"
            className={styles.secondaryLink}
            eventName="subscribe_cta_click"
            eventProperties={{
              page: "/watchlist",
              source: "watchlist_limit_notice"
            }}
          >
            プランを見る
          </TrackedLink>
        </section>
      ) : null}

      {result.error ? <p className={styles.errorText}>watchlist の読み込みに失敗しました: {result.error}</p> : null}

      <section className={styles.section}>
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.sectionEyebrow}>Watchlist Items</p>
            <h2>未来の判断として残した Judgment Cards</h2>
            <p className={styles.sectionLead}>episode / history / replay に戻りながら、saved と watching を切り替えられます。</p>
          </div>
          <span className={styles.sectionCount}>{result.items.length} items</span>
        </div>

        {viewer && result.items.length === 0 ? (
          <div className={styles.emptyPanel}>
            <h3>まだ watchlist は空です</h3>
            <p>`/decisions` や `/decisions/library` の Judgment Card から Save / Watch を選ぶとここに追加されます。</p>
          </div>
        ) : null}

        <div className={styles.grid}>
          {result.items.map((item) => (
            <article key={item.id} className={styles.card}>
              <div className={styles.cardHeader}>
                <div className={styles.badgeRow}>
                  <span className={`${styles.badge} ${styles[`status_${item.status}`]}`.trim()}>{STATUS_LABELS[item.status]}</span>
                  <span className={`${styles.badge} ${styles[`judgment_${item.judgment_type}`]}`.trim()}>
                    {JUDGMENT_LABELS[item.judgment_type]}
                  </span>
                  {isPaid ? (
                    <span className={`${styles.badge} ${styles[`urgency_${item.urgency}`]}`.trim()}>
                      {URGENCY_LABELS[item.urgency]}
                    </span>
                  ) : null}
                </div>
                <div className={styles.tagRow}>
                  <span className={styles.tag}>{item.genre ?? "general"}</span>
                  <span className={styles.tag}>{item.frame_type ?? "frame unknown"}</span>
                </div>
              </div>

              <TrackedLink
                href={`/episodes/${item.episode_id}`}
                className={styles.topicLink}
                eventName="watchlist_card_click"
                eventProperties={{
                  page: "/watchlist",
                  source: "watchlist_topic_link",
                  judgment_card_id: item.judgment_card_id,
                  episode_id: item.episode_id,
                  watchlist_status: item.status,
                  urgency: item.urgency
                }}
              >
                {item.topic_title}
              </TrackedLink>

              <dl className={styles.metaList}>
                <div>
                  <dt>Saved At</dt>
                  <dd>{formatDate(item.created_at, true)}</dd>
                </div>
                <div>
                  <dt>Episode</dt>
                  <dd>{item.episode_title ?? "Untitled episode"}</dd>
                </div>
                <div>
                  <dt>Deadline</dt>
                  <dd>{isPaid ? formatDate(item.deadline_at, true) : "paid で表示"}</dd>
                </div>
              </dl>

              <WatchlistControls
                judgmentCardId={item.judgment_card_id}
                viewer={viewer}
                initialItemId={item.id}
                initialStatus={item.status}
                page="/watchlist"
                source="watchlist_item_card"
                episodeId={item.episode_id}
                genre={item.genre}
                frameType={item.frame_type}
                judgmentType={item.judgment_type}
              />

              <div className={styles.linkRow}>
                <TrackedLink
                  href={`/episodes/${item.episode_id}`}
                  className={styles.inlineLink}
                  eventName="watchlist_card_click"
                  eventProperties={{
                    page: "/watchlist",
                    source: "watchlist_episode_link",
                    judgment_card_id: item.judgment_card_id,
                    episode_id: item.episode_id,
                    watchlist_status: item.status,
                    urgency: item.urgency
                  }}
                >
                  Episode
                </TrackedLink>
                <TrackedLink
                  href="/history"
                  className={styles.inlineLink}
                  eventName="watchlist_card_click"
                  eventProperties={{
                    page: "/watchlist",
                    source: "watchlist_history_link",
                    judgment_card_id: item.judgment_card_id,
                    episode_id: item.episode_id,
                    watchlist_status: item.status,
                    urgency: item.urgency
                  }}
                >
                  History
                </TrackedLink>
                {item.history_decision_id ? (
                  <TrackedLink
                    href={buildDecisionReplayPath(item.history_decision_id)}
                    className={styles.inlineLink}
                    eventName="watchlist_card_click"
                    eventProperties={{
                      page: "/watchlist",
                      source: "watchlist_replay_link",
                      judgment_card_id: item.judgment_card_id,
                      episode_id: item.episode_id,
                      watchlist_status: item.status,
                      urgency: item.urgency
                    }}
                  >
                    Replay
                  </TrackedLink>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
