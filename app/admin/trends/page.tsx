import Link from "next/link";
import { createServiceRoleClient } from "@/app/lib/supabaseClients";
import styles from "./trends.module.css";

export const dynamic = "force-dynamic";

type TrendSourceJoin =
  | {
      name: string | null;
      category: string | null;
      theme: string | null;
    }
  | {
      name: string | null;
      category: string | null;
      theme: string | null;
    }[]
  | null;

type TrendRow = {
  id: string;
  title: string | null;
  url: string | null;
  score: number | null;
  score_freshness: number | null;
  score_source: number | null;
  score_bonus: number | null;
  score_penalty: number | null;
  published_at: string | null;
  created_at: string;
  trend_sources: TrendSourceJoin;
};

const formatDateTime = (value: string | null): string => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("ja-JP", { hour12: false });
};

const formatScore = (value: number | null | undefined): string => {
  if (typeof value !== "number" || !Number.isFinite(value)) return "0.000";
  return value.toFixed(3);
};

const resolveTrendSource = (
  source: TrendSourceJoin
): { name: string; category: string; theme: string } => {
  const value = Array.isArray(source) ? source[0] : source;
  return {
    name: value?.name?.trim() || "unknown",
    category: value?.category?.trim() || "general",
    theme: value?.theme?.trim() || "-"
  };
};

const loadTrends = async (): Promise<{ rows: TrendRow[]; error: string | null }> => {
  try {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from("trend_items")
      .select(
        "id, title, url, score, score_freshness, score_source, score_bonus, score_penalty, published_at, created_at, trend_sources!inner(name, category, theme)"
      )
      .eq("is_cluster_representative", true)
      .order("score", { ascending: false })
      .order("published_at", { ascending: false })
      .limit(120);

    if (error) {
      return { rows: [], error: error.message };
    }

    return { rows: (data as TrendRow[]) ?? [], error: null };
  } catch (error) {
    return {
      rows: [],
      error: error instanceof Error ? error.message : "unknown_error"
    };
  }
};

export default async function AdminTrendsPage() {
  const { rows, error } = await loadTrends();

  return (
    <main className={styles.page}>
      <h1>Trend Score Board</h1>
      <p className={styles.caption}>
        freshness/source/bonus/penalty の内訳と、entertainment加点を含むスコアを確認します。
      </p>

      <p className={styles.navRow}>
        <Link href="/admin/job-runs">/admin/job-runs</Link>
      </p>

      {error ? <p className={styles.errorText}>load error: {error}</p> : null}

      <section className={styles.card}>
        <h2>Recent Trend Items</h2>
        {rows.length === 0 ? (
          <p>trend data is empty</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>published</th>
                  <th>source</th>
                  <th>title</th>
                  <th>score</th>
                  <th>breakdown</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const source = resolveTrendSource(row.trend_sources);
                  return (
                    <tr key={row.id}>
                      <td>{formatDateTime(row.published_at ?? row.created_at)}</td>
                      <td>
                        <div>{source.name}</div>
                        <div>{source.category}</div>
                      </td>
                      <td className={styles.titleCell}>
                        {row.url ? (
                          <a href={row.url} target="_blank" rel="noreferrer noopener">
                            {row.title ?? "(no title)"}
                          </a>
                        ) : (
                          row.title ?? "(no title)"
                        )}
                      </td>
                      <td className={styles.score}>
                        <strong>{formatScore(row.score)}</strong>
                      </td>
                      <td className={styles.breakdown}>
                        <div>
                          freshness: <strong>{formatScore(row.score_freshness)}</strong>
                        </div>
                        <div>
                          source: <strong>{formatScore(row.score_source)}</strong>
                        </div>
                        <div>
                          bonus: <strong>{formatScore(row.score_bonus)}</strong>
                        </div>
                        <div>
                          penalty: <strong>{formatScore(row.score_penalty)}</strong>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
