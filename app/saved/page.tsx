import { redirect } from "next/navigation";
import AnalyticsPageView from "@/app/components/AnalyticsPageView";
import MemberControls from "@/app/components/MemberControls";
import TrackedLink from "@/app/components/TrackedLink";
import WatchlistControls from "@/app/components/WatchlistControls";
import {
  formatEpisodeTitle,
  formatGenreLabel,
  formatTopicTitle,
  JUDGMENT_TYPE_LABELS
} from "@/app/lib/uiText";
import { buildLoginPath } from "@/app/lib/onboarding";
import { getViewerFromCookies } from "@/app/lib/viewer";
import { loadUserWatchlist } from "@/app/lib/watchlist";
import { FREE_WATCHLIST_LIMIT, isWatchlistSort, isWatchlistUrgency } from "@/src/lib/watchlist";
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
  if (!viewer) {
    redirect(buildLoginPath("/saved"));
  }

  const isPaid = viewer?.isPaid ?? false;
  const genre = toSingleValue(resolvedSearchParams.genre).trim() || null;
  const frameType = toSingleValue(resolvedSearchParams.frame).trim() || null;
  const urgencyParam = toSingleValue(resolvedSearchParams.urgency).trim();
  const sortParam = toSingleValue(resolvedSearchParams.sort).trim();
  const urgency = isPaid && isWatchlistUrgency(urgencyParam) ? urgencyParam : null;
  const sort = isWatchlistSort(sortParam)
    ? isPaid || sortParam !== "deadline_soon"
      ? sortParam
      : "newest"
    : "newest";

  const result = await loadUserWatchlist({
    userId: viewer.userId,
    filters: {
      status: "saved",
      genre,
      frameType,
      urgency,
      sort
    }
  });
  const visibleItems = result.items.filter((item) => item.status === "saved" && item.history_decision_id === null);

  return (
    <main className={styles.page}>
      <AnalyticsPageView page="/saved" pageEventName="watchlist_view" />

      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>保存済み</p>
          <h1>気になるトピックを保存して、あとで見直す。</h1>
          <p className={styles.lead}>
            エピソードで気になった判断カードをブックマークしておく場所です。
            あとから振り返りたい内容だけをまとめて確認できます。
          </p>

          <p className={styles.limitText}>
            {isPaid
              ? "有料版では保存件数の上限なく整理できます。"
              : `無料版では最大${FREE_WATCHLIST_LIMIT}件まで保存できます。`}
          </p>
        </div>

        <MemberControls
          viewer={viewer}
          title="プラン"
          copy="迷った候補を残して、あとで見返しやすくします。"
          analyticsSource="/saved"
          variant="compact"
        />
      </section>

      <WatchlistFilters
        initialFilters={{
          status: "saved",
          genre,
          frameType,
          urgency,
          sort
        }}
        options={result.options}
        isPaid={isPaid}
      />

      {!isPaid ? (
        <section className={styles.noticePanel}>
          <h2>無料版は件数制限つきです</h2>
          <p>有料版にすると、より多くのトピックを保存して整理できます。</p>
          <TrackedLink
            href="/account"
            className={styles.secondaryLink}
            eventName="subscribe_cta_click"
            eventProperties={{
              page: "/saved",
              source: "watchlist_limit_notice"
            }}
          >
            プランを見る
          </TrackedLink>
        </section>
      ) : null}

      {result.error ? <p className={styles.errorText}>保存一覧の読み込みに失敗しました。時間をおいて再度お試しください。</p> : null}

      <section className={styles.section}>
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.sectionEyebrow}>保存一覧</p>
            <h2>ブックマークしたトピック</h2>
            <p className={styles.sectionLead}>エピソードの詳細に戻りながら、見直したい内容を整理できます。</p>
          </div>
        </div>

        {visibleItems.length === 0 ? (
          <div className={styles.emptyPanel}>
            <h3>まだ保存したトピックはありません</h3>
            <p>エピソードの詳細画面で「保存」を押すと、ここに追加されます。</p>
          </div>
        ) : null}

        <div className={styles.grid}>
          {visibleItems.map((item) => (
            <article key={item.id} className={styles.card}>
              <div className={styles.cardHeader}>
                <div className={styles.badgeRow}>
                  <span className={`${styles.badge} ${styles[`judgment_${item.judgment_type}`]}`.trim()}>
                    {JUDGMENT_TYPE_LABELS[item.judgment_type]}
                  </span>
                </div>
                <div className={styles.tagRow}>
                  <span className={styles.tag}>{formatGenreLabel(item.genre)}</span>
                </div>
              </div>

              <TrackedLink
                href={`/decisions/${item.episode_id}`}
                className={styles.topicLink}
                eventName="watchlist_card_click"
                eventProperties={{
                  page: "/saved",
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
                  <dt>見直しタイミング</dt>
                  <dd>{isPaid ? formatDate(item.deadline_at, true) : "有料版で表示"}</dd>
                </div>
              </dl>

              <WatchlistControls
                judgmentCardId={item.judgment_card_id}
                viewer={viewer}
                initialItemId={item.id}
                initialStatus={item.status}
                page="/saved"
                source="watchlist_item_card"
                episodeId={item.episode_id}
                genre={item.genre}
                frameType={item.frame_type}
                judgmentType={item.judgment_type}
              />

              <div className={styles.linkRow}>
                <TrackedLink
                  href={`/decisions/${item.episode_id}`}
                  className={styles.inlineLink}
                  eventName="watchlist_card_click"
                  eventProperties={{
                    page: "/saved",
                    source: "watchlist_episode_link",
                    judgment_card_id: item.judgment_card_id,
                    episode_id: item.episode_id,
                    watchlist_status: item.status,
                    urgency: item.urgency
                  }}
                >
                  詳細
                </TrackedLink>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
