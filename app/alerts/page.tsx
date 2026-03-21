import type { Metadata } from "next";
import { redirect } from "next/navigation";
import AlertsInbox from "@/app/components/AlertsInbox";
import AnalyticsPageView from "@/app/components/AnalyticsPageView";
import MemberControls from "@/app/components/MemberControls";
import { resolveAlertsErrorMessage, syncUserAlerts } from "@/app/lib/alerts";
import { buildLoginPath } from "@/app/lib/onboarding";
import { getViewerFromCookies } from "@/app/lib/viewer";
import styles from "@/app/member-surface.module.css";

export const metadata: Metadata = {
  title: "お知らせ",
  description: "期限が近い判断や週次まとめをまとめて確認できます。"
};

export const dynamic = "force-dynamic";

export default async function AlertsPage() {
  const viewer = await getViewerFromCookies();
  if (!viewer) {
    redirect(buildLoginPath("/alerts"));
  }

  const alertState = await syncUserAlerts(viewer);

  return (
    <main className={styles.page}>
      <AnalyticsPageView page="/alerts" pageEventName="alerts_view" />

      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>Alerts</p>
          <h1>見直しタイミングをまとめて確認</h1>
          <p className={styles.lead}>
            期限が近い判断、結果を記録したいトピック、週次まとめをひとつの受信箱で追えます。
          </p>

          <div className={styles.statsGrid}>
            <article className={styles.statCard}>
              <span className={styles.statLabel}>通知件数</span>
              <strong className={styles.statValue}>{alertState.alerts.length}</strong>
            </article>
            <article className={styles.statCard}>
              <span className={styles.statLabel}>未読</span>
              <strong className={styles.statValue}>{alertState.alerts.filter((item) => !item.isRead).length}</strong>
            </article>
          </div>
        </div>

        <MemberControls
          viewer={viewer}
          title="プラン"
          copy="見直しが必要な判断を取りこぼさないための受信箱です。"
          analyticsSource="/alerts"
          variant="compact"
        />
      </section>

      {alertState.error ? <p className={styles.errorText}>{resolveAlertsErrorMessage(alertState.error)}</p> : null}

      <AlertsInbox
        alerts={alertState.alerts}
        page="/alerts"
        title="すべてのお知らせ"
        lead="未読・期限・週次まとめをここでまとめて処理できます。"
        emptyTitle="今は確認が必要なお知らせはありません"
        emptyCopy="期限が近づいた判断や週次まとめが発生すると、ここに届きます。"
      />
    </main>
  );
}
