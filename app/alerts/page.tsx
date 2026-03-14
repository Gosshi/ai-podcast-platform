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
          <p className={styles.eyebrow}>お知らせ</p>
          <h1>アプリを閉じていても、次に見るべき判断を失わない。</h1>
          <p className={styles.lead}>
            期限が近い判断、保存した候補、結果の記録、週ごとのまとめを一箇所にまとめています。
          </p>

          <div className={styles.statGrid}>
            <article className={styles.statCard}>
              <span className={styles.statLabel}>プラン</span>
              <strong className={styles.statValue}>{viewer?.isPaid ? "有料版" : "無料版"}</strong>
            </article>
            <article className={styles.statCard}>
              <span className={styles.statLabel}>未読</span>
              <strong className={styles.statValue}>{unreadCount}</strong>
            </article>
            <article className={styles.statCard}>
              <span className={styles.statLabel}>表示中</span>
              <strong className={styles.statValue}>{alertState.alerts.length}</strong>
            </article>
          </div>

          <div className={styles.linkRow}>
            <Link href="/decisions" className={styles.primaryLink}>
              今日の判断
            </Link>
            <Link href="/weekly-decisions" className={styles.secondaryLink}>
              週ごとのまとめ
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
          <h2>お知らせを見るにはログインが必要です</h2>
          <p>判断カード、保存、履歴がたまると見直したい項目をここに表示します。</p>
          <div className={styles.linkRow}>
            <Link href="/account" className={styles.primaryLink}>
              アカウント
            </Link>
          </div>
        </section>
      ) : null}

      {alertState.error ? <p className={styles.errorText}>お知らせの同期に失敗しました: {alertState.error}</p> : null}

      {viewer ? (
        <AlertsInbox
          alerts={alertState.alerts}
          page="/alerts"
          title="お知らせ一覧"
          lead="見直したい項目をまとめて確認できます。"
        />
      ) : null}
    </main>
  );
}
