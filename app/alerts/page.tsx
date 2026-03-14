import Link from "next/link";
import { redirect } from "next/navigation";
import AlertsInbox from "@/app/components/AlertsInbox";
import AnalyticsPageView from "@/app/components/AnalyticsPageView";
import MemberControls from "@/app/components/MemberControls";
import { resolveAlertsErrorMessage, syncUserAlerts } from "@/app/lib/alerts";
import { buildLoginPath } from "@/app/lib/onboarding";
import { getViewerFromCookies } from "@/app/lib/viewer";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

export default async function AlertsPage() {
  const viewer = await getViewerFromCookies();
  if (!viewer) {
    redirect(buildLoginPath("/alerts"));
  }

  const alertState = await syncUserAlerts(viewer);
  const unreadCount = alertState.alerts.filter((alert) => !alert.isRead).length;

  return (
    <main className={styles.page}>
      <AnalyticsPageView page="/alerts" pageEventName="alerts_view" />

      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>通知</p>
          <h1>アプリを閉じていても、次に見直す判断を失わない。</h1>
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
              今日のおすすめ
            </Link>
            <Link href="/weekly-decisions" className={styles.secondaryLink}>
              週ごとのまとめ
            </Link>
          </div>
        </div>

        <MemberControls
          viewer={viewer}
          title="プラン"
          copy="無料版は通知の要点まで。有料版は判断理由や見直しタイミングに沿ってまとめて確認できます。"
          analyticsSource="/alerts"
          variant="compact"
        />
      </section>

      {alertState.error ? <p className={styles.errorText}>{resolveAlertsErrorMessage(alertState.error)}</p> : null}

      <AlertsInbox
        alerts={alertState.alerts}
        page="/alerts"
        title="通知一覧"
        lead="見直したい項目をまとめて確認できます。"
      />
    </main>
  );
}
