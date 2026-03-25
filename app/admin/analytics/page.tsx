import { requireAdmin } from "@/app/lib/adminGuard";
import { createServiceRoleClient } from "@/app/lib/supabaseClients";
import { buildAnalyticsOverview, type AnalyticsEventRow } from "@/src/lib/analytics";
import s from "../admin.module.css";

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
      return { rows: [], error: error.message };
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
    <main className={s.container}>
      <div className={s.pageHeader}>
        <h1 className={s.pageTitle}>Analytics</h1>
        <p className={s.pageCaption}>
          直近{WINDOW_DAYS}日間のイベントを確認し、conversion / engagement の基礎指標を追います。
        </p>
      </div>

      {error ? <p className={s.errorText}>analytics load error: {error}</p> : null}

      <section className={s.metricGrid}>
        <article className={s.metricCard}>
          <span className={s.metricLabel}>Events</span>
          <strong className={s.metricValue}>{overview.totals.events}</strong>
        </article>
        <article className={s.metricCard}>
          <span className={s.metricLabel}>Anonymous Visitors</span>
          <strong className={s.metricValue}>{overview.totals.anonymousVisitors}</strong>
        </article>
        <article className={s.metricCard}>
          <span className={s.metricLabel}>Free Visitors</span>
          <strong className={s.metricValue}>{overview.totals.freeVisitors}</strong>
        </article>
        <article className={s.metricCard}>
          <span className={s.metricLabel}>Paid Users</span>
          <strong className={s.metricValue}>{overview.totals.paidUsers}</strong>
        </article>
      </section>

      <section className={s.card}>
        <h2 className={s.cardHeader}>Conversion Funnel</h2>
        <div className={s.tableWrap}>
          <table className={s.table}>
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

      <section className={s.card}>
        <h2 className={s.cardHeader}>Engagement</h2>
        <div className={s.tableWrap}>
          <table className={s.table}>
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

      <section className={s.grid2}>
        <article className={s.card}>
          <h2 className={s.cardHeader}>Page Views</h2>
          {overview.pageViews.length === 0 ? (
            <p className={s.emptyText}>page view data is empty</p>
          ) : (
            <ul className={s.list}>
              {overview.pageViews.map((item) => (
                <li key={item.page} className={s.listItem}>
                  <span>{item.page}</span>
                  <strong>{item.total}</strong>
                </li>
              ))}
            </ul>
          )}
        </article>

        <article className={s.card}>
          <h2 className={s.cardHeader}>Top Events</h2>
          {overview.topEvents.length === 0 ? (
            <p className={s.emptyText}>event data is empty</p>
          ) : (
            <ul className={s.list}>
              {overview.topEvents.slice(0, 12).map((item) => (
                <li key={item.eventName} className={s.listItem}>
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
