import Link from "next/link";
import { redirect } from "next/navigation";
import AlertsInbox from "@/app/components/AlertsInbox";
import AnalyticsPageView from "@/app/components/AnalyticsPageView";
import { resolveAlertsErrorMessage, syncUserAlerts } from "@/app/lib/alerts";
import { buildLoginPath } from "@/app/lib/onboarding";
import { getViewerFromCookies } from "@/app/lib/viewer";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

const formatDueAt = (value: string | null): string => {
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

export default async function AlertsPage() {
  const viewer = await getViewerFromCookies();
  if (!viewer) {
    redirect(buildLoginPath("/alerts"));
  }

  const alertState = await syncUserAlerts(viewer);
  const unreadCount = alertState.alerts.filter((alert) => !alert.isRead).length;
  const primaryAlert = alertState.alerts[0] ?? null;
  const secondaryAlerts = primaryAlert ? alertState.alerts.slice(1) : alertState.alerts;

  return (
    <main className={styles.page}>
      <AnalyticsPageView page="/alerts" pageEventName="alerts_view" />

      <section className={styles.todaySection}>
        <div className={styles.todayHeader}>
          <div>
            <p className={styles.eyebrow}>今日対応すべき1件</p>
            <h2>最初に見る通知</h2>
          </div>
        </div>

        {primaryAlert ? (
          <article className={styles.todayCard}>
            <div className={styles.todayMetaRow}>
              <span className={styles.todayType}>{primaryAlert.alertTypeLabel}</span>
              <span className={styles.todayDue}>見直し: {formatDueAt(primaryAlert.dueAt)}</span>
            </div>
            <h3>{primaryAlert.title}</h3>
            <p>{primaryAlert.summary}</p>
            <div className={styles.todayActions}>
              {primaryAlert.links.map((link, index) => (
                <Link
                  key={`${primaryAlert.id}-${link.href}-${index}`}
                  href={link.href}
                  className={index === 0 ? styles.primaryLink : styles.secondaryLink}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </article>
        ) : (
          <div className={styles.todayEmpty}>
            <h3>今日すぐ対応する通知はありません</h3>
            <p>期限が近い判断や結果記録が必要なものが出たら、ここに最優先で表示します。</p>
          </div>
        )}
      </section>

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
      </section>

      {alertState.error ? <p className={styles.errorText}>{resolveAlertsErrorMessage(alertState.error)}</p> : null}

      <AlertsInbox
        alerts={secondaryAlerts}
        page="/alerts"
        title="その他の通知"
        lead="最優先の1件以外は、ここでまとめて確認できます。"
        emptyTitle="その他の通知はありません"
        emptyCopy="今日対応すべき1件以外は、いま追加の通知はありません。"
      />
    </main>
  );
}
