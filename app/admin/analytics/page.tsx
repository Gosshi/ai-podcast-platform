import Link from "next/link";
import { requireAdmin } from "@/app/lib/adminGuard";
import { createServiceRoleClient } from "@/app/lib/supabaseClients";
import { buildAnalyticsOverview, type AnalyticsEventRow } from "@/src/lib/analytics";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

const WINDOW_DAYS = 30;

const loadAnalyticsEvents = async (): Promise<{ rows: AnalyticsEventRow[]; error: string | null }> => {
  try {
    const supabase = createServiceRoleClient();
    const windowStart = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from("analytics_events")
      .select("anonymous_id, user_id, event_name, page, source, is_paid, created_at")
      .gte("created_at", windowStart)
      .order("created_at", { ascending: false })
      .limit(5000);

    if (error) {
      return {
        rows: [],
        error: error.message
      };
    }

    return {
      rows: ((data as AnalyticsEventRow[] | null) ?? []).filter((row) => Boolean(row.event_name)),
      error: null
    };
  } catch (error) {
    return {
      rows: [],
      error: error instanceof Error ? error.message : "unknown_error"
    };
  }
};

export default async function AdminAnalyticsPage() {
  await requireAdmin("/admin/analytics");
  const { rows, error } = await loadAnalyticsEvents();
  const overview = buildAnalyticsOverview(rows, WINDOW_DAYS);

  return (
    <main className={styles.page}>
      <div className={styles.headerRow}>
        <div>
          <p className={styles.eyebrow}>Admin Analytics</p>
          <h1>Product Analytics Foundation</h1>
          <p className={styles.caption}>
            直近{WINDOW_DAYS}日間のイベントを軽く確認し、conversion / engagement / retention の基礎指標を追います。
          </p>
        </div>
        <div className={styles.navRow}>
          <Link href="/admin/trends">/admin/trends</Link>
          <Link href="/admin/job-runs">/admin/job-runs</Link>
          <Link href="/admin/manual-publish">/admin/manual-publish</Link>
        </div>
      </div>

      {error ? <p className={styles.errorText}>analytics load error: {error}</p> : null}

      <section className={styles.summaryGrid}>
        <article className={styles.metricCard}>
          <span className={styles.metricLabel}>Events</span>
          <strong>{overview.totals.events}</strong>
        </article>
        <article className={styles.metricCard}>
          <span className={styles.metricLabel}>Anonymous</span>
          <strong>{overview.totals.anonymous}</strong>
        </article>
        <article className={styles.metricCard}>
          <span className={styles.metricLabel}>Free</span>
          <strong>{overview.totals.free}</strong>
        </article>
        <article className={styles.metricCard}>
          <span className={styles.metricLabel}>Paid</span>
          <strong>{overview.totals.paid}</strong>
        </article>
      </section>

      <section className={styles.panel}>
        <h2>Conversion Funnel</h2>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>metric</th>
                <th>total</th>
                <th>free</th>
                <th>paid</th>
              </tr>
            </thead>
            <tbody>
              {overview.funnel.map((item) => (
                <tr key={item.eventName}>
                  <td>{item.label}</td>
                  <td>{item.total}</td>
                  <td>{item.free}</td>
                  <td>{item.paid}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className={styles.panel}>
        <h2>Engagement</h2>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>metric</th>
                <th>total</th>
                <th>free</th>
                <th>paid</th>
              </tr>
            </thead>
            <tbody>
              {overview.engagement.map((item) => (
                <tr key={item.eventName}>
                  <td>{item.label}</td>
                  <td>{item.total}</td>
                  <td>{item.free}</td>
                  <td>{item.paid}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className={styles.grid}>
        <article className={styles.panel}>
          <h2>Page Views</h2>
          {overview.pageViews.length === 0 ? (
            <p className={styles.emptyText}>page view data is empty</p>
          ) : (
            <ul className={styles.list}>
              {overview.pageViews.map((item) => (
                <li key={item.page}>
                  <span>{item.page}</span>
                  <strong>{item.total}</strong>
                </li>
              ))}
            </ul>
          )}
        </article>

        <article className={styles.panel}>
          <h2>Top Events</h2>
          {overview.topEvents.length === 0 ? (
            <p className={styles.emptyText}>event data is empty</p>
          ) : (
            <ul className={styles.list}>
              {overview.topEvents.slice(0, 12).map((item) => (
                <li key={item.eventName}>
                  <span>{item.eventName}</span>
                  <strong>{item.total}</strong>
                </li>
              ))}
            </ul>
          )}
        </article>
      </section>
    </main>
  );
}
