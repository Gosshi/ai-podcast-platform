import AnalyticsPageView from "@/app/components/AnalyticsPageView";
import MemberControls from "@/app/components/MemberControls";
import TrackedLink from "@/app/components/TrackedLink";
import WatchlistControls from "@/app/components/WatchlistControls";
import { buildDecisionReplayPath } from "@/app/lib/decisionReplay";
import { formatEpisodeTitle, formatFrameTypeLabel, formatTopicTitle, JUDGMENT_TYPE_LABELS, URGENCY_LABELS, WATCHLIST_STATUS_LABELS } from "@/app/lib/uiText";
import { getViewerFromCookies } from "@/app/lib/viewer";
import { loadUserWatchlist } from "@/app/lib/watchlist";
import {
  FREE_WATCHLIST_LIMIT,
  isWatchlistSort,
  isWatchlistStatus,
  isWatchlistUrgency
} from "@/src/lib/watchlist";
import WatchlistFilters from "./WatchlistFilters";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

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
          <p className={styles.eyebrow}>保存</p>
          <h1>まだ決めていない判断を、期限と状態つきで管理する。</h1>
          <p className={styles.lead}>
            履歴が「採用した判断」を記録するのに対して、この画面は「今は決めないが後で見返す判断」を残す場所です。
            迷った候補を整理しながら、あとで判断し直せます。
          </p>

          <div className={styles.statRow}>
            <article className={styles.statCard}>
              <span className={styles.statLabel}>進行中</span>
              <strong>{activeCount}</strong>
            </article>
            <article className={styles.statCard}>
              <span className={styles.statLabel}>合計</span>
              <strong>{result.items.length}</strong>
            </article>
            <article className={styles.statCard}>
              <span className={styles.statLabel}>プラン</span>
              <strong>{isPaid ? "有料版" : "無料版"}</strong>
            </article>
          </div>

          <p className={styles.limitText}>
            {viewer
              ? isPaid
                ? "有料版では保存件数の上限なく、期限つきで見直せます。"
                : `無料版では進行中の候補を最大${FREE_WATCHLIST_LIMIT}件まで保存できます。`
              : "ログインすると判断カードを保存して、ここで一覧管理できます。"}
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
          <h2>保存を使うにはログインが必要です</h2>
          <p>判断カードを保存すると、この画面であとから見直せます。</p>
          <TrackedLink
            href="/account"
            className={styles.primaryLink}
            eventName="subscribe_cta_click"
            eventProperties={{
              page: "/watchlist",
              source: "watchlist_login_notice"
            }}
          >
            アカウントでログイン
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
          <h2>無料版は件数制限つきです</h2>
          <p>有料版にすると、より多くの候補を保存しながら期限つきで見直せます。</p>
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

      {result.error ? <p className={styles.errorText}>保存一覧の読み込みに失敗しました: {result.error}</p> : null}

      <section className={styles.section}>
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.sectionEyebrow}>保存一覧</p>
            <h2>保存した判断一覧</h2>
            <p className={styles.sectionLead}>詳細や履歴に戻りながら、あとで見る候補を整理できます。</p>
          </div>
          <span className={styles.sectionCount}>{result.items.length}件</span>
        </div>

        {viewer && result.items.length === 0 ? (
          <div className={styles.emptyPanel}>
            <h3>まだ保存した判断はありません</h3>
            <p>`/decisions` や `/decisions/library` の判断カードから保存するとここに追加されます。</p>
          </div>
        ) : null}

        <div className={styles.grid}>
          {result.items.map((item) => (
            <article key={item.id} className={styles.card}>
              <div className={styles.cardHeader}>
                <div className={styles.badgeRow}>
                  <span className={`${styles.badge} ${styles[`status_${item.status}`]}`.trim()}>{WATCHLIST_STATUS_LABELS[item.status]}</span>
                  <span className={`${styles.badge} ${styles[`judgment_${item.judgment_type}`]}`.trim()}>
                    {JUDGMENT_TYPE_LABELS[item.judgment_type]}
                  </span>
                  {isPaid ? (
                    <span className={`${styles.badge} ${styles[`urgency_${item.urgency}`]}`.trim()}>
                      {URGENCY_LABELS[item.urgency]}
                    </span>
                  ) : null}
                </div>
                <div className={styles.tagRow}>
                  <span className={styles.tag}>{item.genre ?? "配信作品"}</span>
                  <span className={styles.tag}>{formatFrameTypeLabel(item.frame_type, "判断タイプ未設定")}</span>
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
                {formatTopicTitle(item.topic_title)}
              </TrackedLink>

              <dl className={styles.metaList}>
                <div>
                  <dt>保存日</dt>
                  <dd>{formatDate(item.created_at, true)}</dd>
                </div>
                <div>
                  <dt>詳細</dt>
                  <dd>{formatEpisodeTitle(item.episode_title)}</dd>
                </div>
                <div>
                  <dt>期限</dt>
                  <dd>{isPaid ? formatDate(item.deadline_at, true) : "有料版で表示"}</dd>
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
                  詳細
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
                  履歴
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
                    振り返り
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
