import Link from "next/link";
import AlertsInbox from "@/app/components/AlertsInbox";
import AnalyticsPageView from "@/app/components/AnalyticsPageView";
import MemberControls from "@/app/components/MemberControls";
import { syncUserAlerts } from "@/app/lib/alerts";
import { getViewerFromCookies } from "@/app/lib/viewer";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

export default async function AlertsPage() {
  const viewer = await getViewerFromCookies();
  const alertState = viewer
    ? await syncUserAlerts(viewer)
    : {
        alerts: [],
        preferences: null,
        error: null
      };
  const unreadCount = alertState.alerts.filter((alert) => !alert.isRead).length;

  return (
    <main className={styles.page}>
      <AnalyticsPageView page="/alerts" pageEventName="alerts_view" />

      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>Alerts Inbox</p>
          <h1>アプリを閉じていても、次に見るべき判断を失わない。</h1>
          <p className={styles.lead}>
            deadline、watchlist、outcome reminder、weekly digest を一箇所にまとめています。今は in-app delivery までに留めつつ、email / push / scheduled jobs に流用できる形で保存します。
          </p>

          <div className={styles.statGrid}>
            <article className={styles.statCard}>
              <span className={styles.statLabel}>Plan</span>
              <strong className={styles.statValue}>{viewer?.isPaid ? "PAID" : "FREE"}</strong>
            </article>
            <article className={styles.statCard}>
              <span className={styles.statLabel}>Unread</span>
              <strong className={styles.statValue}>{unreadCount}</strong>
            </article>
            <article className={styles.statCard}>
              <span className={styles.statLabel}>Visible Alerts</span>
              <strong className={styles.statValue}>{alertState.alerts.length}</strong>
            </article>
          </div>

          <div className={styles.linkRow}>
            <Link href="/decisions" className={styles.primaryLink}>
              Decisions
            </Link>
            <Link href="/weekly-decisions" className={styles.secondaryLink}>
              Weekly Digest
            </Link>
          </div>
        </div>

        <MemberControls
          viewer={viewer}
          title="プラン"
          copy="無料版は一部のお知らせまで。有料版はまとめて見直せます。"
          analyticsSource="/alerts"
          variant="compact"
        />
      </section>

      {!viewer ? (
        <section className={styles.noticePanel}>
          <h2>Alerts を使うにはログインが必要です</h2>
          <p>判断カード、watchlist、decision history がたまると alert 候補を生成してここに表示します。</p>
          <div className={styles.linkRow}>
            <Link href="/account" className={styles.primaryLink}>
              Account
            </Link>
          </div>
        </section>
      ) : null}

      {alertState.error ? <p className={styles.errorText}>alerts の同期に失敗しました: {alertState.error}</p> : null}

      {viewer ? (
        <AlertsInbox
          alerts={alertState.alerts}
          page="/alerts"
          title="Your Alerts"
          lead="生成した alert は `user_alerts` に保存し、mark read / dismiss / future delivery に共通で使います。"
        />
      ) : null}
    </main>
  );
}
