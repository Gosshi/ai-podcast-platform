import AnalyticsEventOnRender from "@/app/components/AnalyticsEventOnRender";
import AnalyticsPageView from "@/app/components/AnalyticsPageView";
import MemberControls from "@/app/components/MemberControls";
import TrackedLink from "@/app/components/TrackedLink";
import { loadWeeklyDecisionDigest } from "@/app/lib/weeklyDecisionDigest";
import { getViewerFromCookies } from "@/app/lib/viewer";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

const JUDGMENT_TYPE_LABELS = {
  use_now: "今週の使う",
  watch: "今週の監視",
  skip: "今週の見送り"
} as const;

const JUDGMENT_TYPE_BADGES = {
  use_now: "使う",
  watch: "監視",
  skip: "見送り"
} as const;

const formatWindowLabel = (start: string, end: string): string => {
  const startDate = new Date(start);
  const endDate = new Date(end);

  return `${startDate.toLocaleDateString("ja-JP", {
    month: "short",
    day: "numeric"
  })} - ${endDate.toLocaleDateString("ja-JP", {
    month: "short",
    day: "numeric"
  })}`;
};

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

export default async function WeeklyDecisionsPage() {
  const viewer = await getViewerFromCookies();
  const isPaid = viewer?.isPaid ?? false;
  const { digest, error } = await loadWeeklyDecisionDigest({ isPaid });
  const windowLabel = formatWindowLabel(digest.windowStart, digest.windowEnd);

  return (
    <main className={styles.page}>
      <AnalyticsPageView page="/weekly-decisions" pageEventName="weekly_digest_view" />
      <AnalyticsEventOnRender
        eventName="weekly_digest_open"
        properties={{
          page: "/weekly-decisions",
          source: "weekly_decisions_page"
        }}
      />
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>Weekly Decision Digest</p>
          <h1>毎日追えなくても、週単位で「今どう判断するか」を回収できる。</h1>
          <p className={styles.lead}>
            直近7日間の judgment cards を `use_now / watch / skip` ごとにまとめて、今週の意思決定を一画面で振り返れます。
          </p>
          <div className={styles.heroMeta}>
            <span className={styles.heroBadge}>{isPaid ? "PAID" : "FREE"}</span>
            <span className={styles.stat}>{windowLabel}</span>
            <span className={styles.stat}>使う {digest.counts.use_now}件</span>
            <span className={styles.stat}>監視 {digest.counts.watch}件</span>
            <span className={styles.stat}>見送り {digest.counts.skip}件</span>
          </div>
          <div className={styles.breakdownRow}>
            {digest.genreBreakdown.slice(0, 3).map((item) => (
              <span key={`genre-${item.key}`}>genre: {item.key} {item.count}</span>
            ))}
            {digest.frameTypeBreakdown.slice(0, 3).map((item) => (
              <span key={`frame-${item.key}`}>frame: {item.key} {item.count}</span>
            ))}
          </div>
        </div>

        <MemberControls
          viewer={viewer}
          title="Digest Access"
          copy="無料版は週次 digest の一部 preview まで。有料会員になると全件と deadline を含む判断一覧を確認できます。"
          analyticsSource="/weekly-decisions"
        />
      </section>

      {error ? <p className={styles.errorText}>weekly digest の読み込みに失敗しました: {error}</p> : null}

      {!isPaid && digest.previewLimited ? (
        <section className={styles.paywallBanner}>
          <div>
            <p className={styles.eyebrow}>Preview</p>
            <h2>無料版はカテゴリごとに一部だけ表示します</h2>
            <p>有料会員になると今週の全件と deadline 付きの判断一覧をまとめて確認できます。</p>
          </div>
          <TrackedLink
            href="/account"
            className={styles.paywallLink}
            eventName="subscribe_cta_click"
            eventProperties={{
              page: "/weekly-decisions",
              source: "weekly_digest_paywall_banner"
            }}
          >
            Upgrade
          </TrackedLink>
        </section>
      ) : null}

      {(["use_now", "watch", "skip"] as const).map((judgmentType) => {
        const items = digest.grouped[judgmentType];

        return (
          <section key={judgmentType} className={styles.section}>
            <div className={styles.sectionHeading}>
              <div>
                <p className={styles.sectionEyebrow}>Weekly Digest</p>
                <h2>{JUDGMENT_TYPE_LABELS[judgmentType]}</h2>
              </div>
              <span className={styles.sectionCount}>{digest.counts[judgmentType]}件</span>
            </div>

            {items.length === 0 ? (
              <p className={styles.emptyText}>この分類の判断はまだありません。</p>
            ) : (
              <div className={styles.grid}>
                {items.map((item) => (
                  <TrackedLink
                    key={item.id}
                    href={`/episodes/${item.episode_id}`}
                    className={styles.card}
                    eventName="weekly_digest_item_click"
                    eventProperties={{
                      page: "/weekly-decisions",
                      source: `weekly_digest_${judgmentType}`,
                      episode_id: item.episode_id,
                      judgment_card_id: item.id,
                      genre: item.genre ?? undefined,
                      frame_type: item.frame_type ?? undefined,
                      judgment_type: item.judgment_type
                    }}
                  >
                    <div className={styles.cardHeader}>
                      <span className={`${styles.badge} ${styles[`badge_${item.judgment_type}`]}`.trim()}>
                        {JUDGMENT_TYPE_BADGES[item.judgment_type]}
                      </span>
                      <span className={styles.genreTag}>{item.genre ?? "general"}</span>
                    </div>
                    <h3>{item.topic_title}</h3>
                    <p>{item.judgment_summary}</p>
                    <dl className={styles.metaList}>
                      <div>
                        <dt>Deadline</dt>
                        <dd>{isPaid ? formatDeadline(item.deadline_at) : "有料会員で表示"}</dd>
                      </div>
                      <div>
                        <dt>Episode</dt>
                        <dd>{item.episode_title ?? "Untitled episode"}</dd>
                      </div>
                    </dl>
                  </TrackedLink>
                ))}
              </div>
            )}
          </section>
        );
      })}
    </main>
  );
}
