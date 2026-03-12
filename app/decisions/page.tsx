import Link from "next/link";
import MemberControls from "@/app/components/MemberControls";
import { loadDecisionDashboardCards } from "@/app/lib/decisions";
import { getViewerFromCookies } from "@/app/lib/viewer";
import { groupDecisionDashboardCards, pickTodayDecisionCards } from "@/src/lib/decisionDashboard";
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
  const { cards, error } = await loadDecisionDashboardCards({ isPaid });
  const todayCards = pickTodayDecisionCards(cards);
  const groupedCards = groupDecisionDashboardCards(cards);
  const todayLabel = formatDecisionDate(todayCards[0]?.episode_published_at ?? null);

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>Decision Dashboard</p>
          <h1>毎日見るべき入口を、エピソードではなく判断に切り替える。</h1>
          <p className={styles.lead}>
            `episode_judgment_cards` を横断して、今日使うもの、監視するもの、見送るものを一画面で確認できます。
          </p>
          <div className={styles.heroMeta}>
            <span className={styles.heroBadge}>{isPaid ? "PAID" : "FREE"}</span>
            <span>{isPaid ? "最新20件を一覧表示" : "最新3件をプレビュー表示"}</span>
          </div>
        </div>

        <MemberControls
          viewer={viewer}
          title="Decision Access"
          copy="無料版は最大3件の判断プレビューまで。有料会員になると decision dashboard の全文と archive が開放されます。"
        />
      </section>

      {error ? (
        <p className={styles.errorText}>判断カードの読み込みに失敗しました: {error}</p>
      ) : null}

      {!isPaid ? (
        <section className={styles.paywallBanner}>
          <div>
            <p className={styles.paywallEyebrow}>Free Preview</p>
            <h2>詳細はぼかして表示しています</h2>
            <p>
              無料版は3件まで表示し、summary と deadline はぼかします。判断の全文は有料会員で開放します。
            </p>
          </div>
          <Link href="/account" className={styles.paywallLink}>
            Upgrade
          </Link>
        </section>
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
          <p className={styles.emptyText}>判断カードはまだありません。</p>
        ) : (
          <div className={styles.grid}>
            {todayCards.map((card) => (
              <Link key={card.id} href={`/episodes/${card.episode_id}`} className={styles.card}>
                <div className={styles.cardHeader}>
                  <span className={`${styles.badge} ${styles[`badge_${card.judgment_type}`]}`.trim()}>
                    {JUDGMENT_TYPE_LABELS[card.judgment_type]}
                  </span>
                  <span className={styles.genreTag}>{card.genre ?? "general"}</span>
                </div>
                <h3>{card.topic_title}</h3>
                <div className={!isPaid ? styles.masked : ""}>
                  <p className={styles.summary}>{card.judgment_summary}</p>
                  <dl className={styles.metaList}>
                    <div>
                      <dt>期限</dt>
                      <dd>{formatDeadline(card.deadline_at)}</dd>
                    </div>
                    <div>
                      <dt>元エピソード</dt>
                      <dd>{card.episode_title ?? "Untitled episode"}</dd>
                    </div>
                  </dl>
                </div>
                {!isPaid ? <span className={styles.lockedNote}>Paidで全文を表示</span> : null}
              </Link>
            ))}
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
                {sectionCards.map((card) => (
                  <Link key={card.id} href={`/episodes/${card.episode_id}`} className={styles.card}>
                    <div className={styles.cardHeader}>
                      <span className={`${styles.badge} ${styles[`badge_${card.judgment_type}`]}`.trim()}>
                        {JUDGMENT_TYPE_LABELS[card.judgment_type]}
                      </span>
                      <span className={styles.genreTag}>{card.genre ?? "general"}</span>
                    </div>
                    <h3>{card.topic_title}</h3>
                    <div className={!isPaid ? styles.masked : ""}>
                      <p className={styles.summary}>{card.judgment_summary}</p>
                      <dl className={styles.metaList}>
                        <div>
                          <dt>期限</dt>
                          <dd>{formatDeadline(card.deadline_at)}</dd>
                        </div>
                        <div>
                          <dt>公開日</dt>
                          <dd>{formatDecisionDate(card.episode_published_at)}</dd>
                        </div>
                      </dl>
                    </div>
                    {!isPaid ? <span className={styles.lockedNote}>Preview only</span> : null}
                  </Link>
                ))}
              </div>
            )}
          </section>
        );
      })}
    </main>
  );
}
