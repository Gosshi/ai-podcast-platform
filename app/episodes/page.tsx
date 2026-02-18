import Link from "next/link";
import { createServiceRoleClient } from "@/app/lib/supabaseClients";
import styles from "./episodes.module.css";

export const dynamic = "force-dynamic";

type EpisodeLang = "ja" | "en";

type EpisodeStatus = "draft" | "queued" | "generating" | "ready" | "published" | "failed";

type EpisodeRow = {
  id: string;
  master_id: string | null;
  lang: EpisodeLang;
  status: EpisodeStatus;
  title: string | null;
  script: string | null;
  audio_url: string | null;
  published_at: string | null;
  created_at: string;
};

type JobRunRow = {
  id: string;
  job_type: string;
  status: "failed";
  payload: unknown;
  error: string | null;
  started_at: string;
};

type SourceMeta = {
  source: string;
  title: string;
};

type SourceItem = {
  source: string;
  title: string;
  url: string | null;
};

type EpisodeGroup = {
  key: string;
  topic: string;
  dateValue: string;
  sortAt: number;
  ja?: EpisodeRow;
  en?: EpisodeRow;
};

type ViewLang = "all" | "ja" | "en";

type SearchParams = {
  lang?: string;
};

type FailedRunIndex = {
  byEpisodeId: Map<string, JobRunRow>;
  unlinkedCount: number;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SCRIPT_PREVIEW_MAX_CHARS = 2400;

const formatDateTime = (value: string | null): string => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("ja-JP", { hour12: false });
};

const formatDateOnly = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("ja-JP");
};

const toTimestamp = (value: string): number => {
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
};

const resolveViewLang = (value: string | undefined): ViewLang => {
  if (value === "ja" || value === "en") return value;
  return "all";
};

const stripLangSuffix = (value: string | null): string => {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return "Untitled Episode";
  return trimmed.replace(/\s*\((JA|EN)\)\s*$/i, "").trim() || trimmed;
};

const resolveDateValue = (episode: EpisodeRow): string => {
  return episode.published_at ?? episode.created_at;
};

const collectUuids = (value: unknown, bucket: Set<string>): void => {
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (UUID_PATTERN.test(normalized)) {
      bucket.add(normalized);
    }
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectUuids(item, bucket);
    }
    return;
  }

  if (value && typeof value === "object") {
    for (const item of Object.values(value as Record<string, unknown>)) {
      collectUuids(item, bucket);
    }
  }
};

const buildFailedRunIndex = (runs: JobRunRow[]): FailedRunIndex => {
  const byEpisodeId = new Map<string, JobRunRow>();
  let unlinkedCount = 0;

  for (const run of runs) {
    const ids = new Set<string>();
    collectUuids(run.payload, ids);

    if (ids.size === 0) {
      unlinkedCount += 1;
      continue;
    }

    for (const id of ids) {
      if (!byEpisodeId.has(id)) {
        byEpisodeId.set(id, run);
      }
    }
  }

  return { byEpisodeId, unlinkedCount };
};

const parseScriptSections = (script: string | null): Record<string, string> => {
  if (!script) return {};

  const sections: Record<string, string[]> = {};
  let activeSection = "";

  for (const line of script.split(/\r?\n/)) {
    const marker = line.match(/^\[([^\]]+)\]\s*$/);
    if (marker) {
      activeSection = marker[1].trim();
      if (!sections[activeSection]) {
        sections[activeSection] = [];
      }
      continue;
    }

    if (activeSection) {
      sections[activeSection].push(line);
    }
  }

  return Object.fromEntries(
    Object.entries(sections).map(([key, lines]) => [key, lines.join("\n").trim()])
  );
};

const parseSourceMeta = (sourcesSection: string): SourceMeta[] => {
  if (!sourcesSection) return [];

  return sourcesSection
    .split(/\r?\n/)
    .map((line) => line.trim())
    .map((line) => {
      const jaMatch = line.match(/^-\s*媒体名:\s*(.+?)\s*\/\s*タイトル:\s*(.+)$/);
      if (jaMatch) {
        return { source: jaMatch[1].trim(), title: jaMatch[2].trim() };
      }

      const enMatch = line.match(/^-\s*Outlet:\s*(.+?)\s*\/\s*Title:\s*(.+)$/i);
      if (enMatch) {
        return { source: enMatch[1].trim(), title: enMatch[2].trim() };
      }

      return null;
    })
    .filter((row): row is SourceMeta => Boolean(row));
};

const parseUrls = (text: string): string[] => {
  if (!text) return [];

  const urls = new Set<string>();
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/https?:\/\/\S+/g);
    if (!match) continue;

    for (const raw of match) {
      urls.add(raw.trim());
    }
  }

  return Array.from(urls);
};

const resolveSourceNameFromUrl = (url: string | null): string => {
  if (!url) return "-";

  try {
    return new URL(url).hostname.replace(/^www\./, "") || "-";
  } catch {
    return "-";
  }
};

const extractSources = (script: string | null): SourceItem[] => {
  const sections = parseScriptSections(script);
  const sourceMeta = parseSourceMeta(sections.SOURCES ?? "");
  const sourceUrls = parseUrls(sections.SOURCES_FOR_UI ?? "");
  const fallbackUrls = sourceUrls.length > 0 ? sourceUrls : parseUrls(script ?? "");
  const rowCount = Math.max(sourceMeta.length, fallbackUrls.length);

  if (rowCount === 0) {
    return [];
  }

  return Array.from({ length: rowCount }, (_, index) => {
    const meta = sourceMeta[index];
    const url = fallbackUrls[index] ?? null;
    return {
      source: meta?.source ?? resolveSourceNameFromUrl(url),
      title: meta?.title ?? "-",
      url
    };
  });
};

const resolveGroupKey = (episode: EpisodeRow, masterIds: Set<string>): string => {
  if (episode.lang === "ja" && masterIds.has(episode.id)) {
    return `pair:${episode.id}`;
  }

  if (episode.lang === "en" && episode.master_id) {
    return `pair:${episode.master_id}`;
  }

  return `topic:${resolveDateValue(episode).slice(0, 10)}:${stripLangSuffix(episode.title).toLowerCase()}`;
};

const buildEpisodeGroups = (episodes: EpisodeRow[]): EpisodeGroup[] => {
  const masterIds = new Set(
    episodes
      .filter((episode) => episode.lang === "en" && Boolean(episode.master_id))
      .map((episode) => String(episode.master_id))
  );
  const groups = new Map<string, EpisodeGroup>();

  for (const episode of episodes) {
    const key = resolveGroupKey(episode, masterIds);
    const group =
      groups.get(key) ??
      ({
        key,
        topic: stripLangSuffix(episode.title),
        dateValue: resolveDateValue(episode),
        sortAt: toTimestamp(resolveDateValue(episode))
      } satisfies EpisodeGroup);

    if (episode.lang === "ja") {
      group.ja = group.ja ?? episode;
    } else {
      group.en = group.en ?? episode;
    }

    if (group.topic === "Untitled Episode" && episode.title) {
      group.topic = stripLangSuffix(episode.title);
    }

    const dateValue = resolveDateValue(episode);
    const sortAt = toTimestamp(dateValue);
    if (sortAt > group.sortAt) {
      group.sortAt = sortAt;
      group.dateValue = dateValue;
    }

    groups.set(key, group);
  }

  return Array.from(groups.values()).sort((a, b) => b.sortAt - a.sortAt);
};

const pickEpisodesByViewLang = (group: EpisodeGroup, viewLang: ViewLang): EpisodeRow[] => {
  const all = [group.ja, group.en].filter((episode): episode is EpisodeRow => Boolean(episode));
  if (viewLang === "all") return all;
  return all.filter((episode) => episode.lang === viewLang);
};

const hasFailedRunForGroup = (group: EpisodeGroup, failedRunIndex: FailedRunIndex): JobRunRow | null => {
  const ids = [group.ja?.id, group.en?.id, group.en?.master_id]
    .filter((id): id is string => Boolean(id))
    .map((id) => id.toLowerCase());

  for (const id of ids) {
    const run = failedRunIndex.byEpisodeId.get(id);
    if (run) {
      return run;
    }
  }

  return null;
};

const resolveStatusLabel = (episode: EpisodeRow, failedRun: JobRunRow | null): string => {
  if (failedRun || episode.status === "failed") {
    return "失敗（再実行はops画面）";
  }

  if (!episode.audio_url) {
    return "生成中/未生成";
  }

  if (episode.published_at) {
    return "公開済み";
  }

  return "準備完了";
};

const buildScriptPreview = (script: string | null): string => {
  if (!script) return "-";
  if (script.length <= SCRIPT_PREVIEW_MAX_CHARS) return script;
  return `${script.slice(0, SCRIPT_PREVIEW_MAX_CHARS).trimEnd()}\n\n...(preview)`;
};

const loadEpisodesWithFailedRuns = async (): Promise<{
  episodes: EpisodeRow[];
  failedRuns: JobRunRow[];
  error: string | null;
}> => {
  try {
    const supabase = createServiceRoleClient();

    const { data: episodeRows, error: episodeError } = await supabase
      .from("episodes")
      .select("id, master_id, lang, status, title, script, audio_url, published_at, created_at")
      .in("lang", ["ja", "en"])
      .order("created_at", { ascending: false })
      .limit(150);

    if (episodeError) {
      return { episodes: [], failedRuns: [], error: episodeError.message };
    }

    const { data: failedRunRows, error: failedRunError } = await supabase
      .from("job_runs")
      .select("id, job_type, status, payload, error, started_at")
      .eq("status", "failed")
      .order("started_at", { ascending: false })
      .limit(200);

    if (failedRunError) {
      return {
        episodes: (episodeRows as EpisodeRow[]) ?? [],
        failedRuns: [],
        error: `failed to load job runs: ${failedRunError.message}`
      };
    }

    return {
      episodes: (episodeRows as EpisodeRow[]) ?? [],
      failedRuns: (failedRunRows as JobRunRow[]) ?? [],
      error: null
    };
  } catch (error) {
    return {
      episodes: [],
      failedRuns: [],
      error: error instanceof Error ? error.message : "unknown_error"
    };
  }
};

export default async function EpisodesPage({
  searchParams
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const viewLang = resolveViewLang(params.lang);
  const { episodes, failedRuns, error } = await loadEpisodesWithFailedRuns();
  const groups = buildEpisodeGroups(episodes);
  const failedRunIndex = buildFailedRunIndex(failedRuns);

  const visibleGroups = groups.filter((group) => pickEpisodesByViewLang(group, viewLang).length > 0);
  const tabItems: { label: string; value: ViewLang; href: string }[] = [
    { label: "JA + EN", value: "all", href: "/episodes" },
    { label: "JAのみ", value: "ja", href: "/episodes?lang=ja" },
    { label: "ENのみ", value: "en", href: "/episodes?lang=en" }
  ];

  const sourceCache = new Map<string, SourceItem[]>();
  const resolveSourcesForEpisode = (episode: EpisodeRow): SourceItem[] => {
    const cached = sourceCache.get(episode.id);
    if (cached) return cached;
    const parsed = extractSources(episode.script);
    sourceCache.set(episode.id, parsed);
    return parsed;
  };

  return (
    <main className={styles.page}>
      <h1>Episodes</h1>
      <p className={styles.caption}>JA/EN切替、同一回のペア表示、Sources、script折りたたみに対応しています。</p>

      <nav className={styles.tabs} aria-label="Language filter">
        {tabItems.map((tab) => (
          <Link
            key={tab.value}
            href={tab.href}
            className={`${styles.tab} ${viewLang === tab.value ? styles.tabActive : ""}`.trim()}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      {error ? <p className={styles.error}>Failed to load episodes: {error}</p> : null}
      {failedRuns.length > 0 ? (
        <p className={styles.failureSummary}>
          failed job_runs: {failedRuns.length}
          {failedRunIndex.unlinkedCount > 0 ? ` (unlinked: ${failedRunIndex.unlinkedCount})` : ""}
        </p>
      ) : null}

      {visibleGroups.length === 0 ? (
        <p>No episodes yet.</p>
      ) : (
        <div className={styles.groupList}>
          {visibleGroups.map((group) => {
            const rows = pickEpisodesByViewLang(group, viewLang);
            const failedRun = hasFailedRunForGroup(group, failedRunIndex);

            return (
              <section key={group.key} className={styles.groupCard}>
                <header className={styles.groupHeader}>
                  <h2>{group.topic}</h2>
                  <p>{formatDateOnly(group.dateValue)}</p>
                </header>

                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Language</th>
                        <th>Title</th>
                        <th>Published At</th>
                        <th>Status</th>
                        <th>Script</th>
                        <th>Sources</th>
                        <th>Audio</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((episode) => {
                        const statusLabel = resolveStatusLabel(episode, failedRun);
                        const sources = resolveSourcesForEpisode(episode);
                        const isFailure = statusLabel.startsWith("失敗");

                        return (
                          <tr key={episode.id}>
                            <td>{episode.lang.toUpperCase()}</td>
                            <td>{episode.title ?? "-"}</td>
                            <td>{formatDateTime(episode.published_at)}</td>
                            <td>
                              <span
                                className={`${styles.status} ${
                                  isFailure
                                    ? styles.statusFailed
                                    : statusLabel === "生成中/未生成"
                                      ? styles.statusPending
                                      : styles.statusReady
                                }`.trim()}
                              >
                                {statusLabel}
                              </span>
                              {failedRun ? (
                                <p className={styles.failureDetail}>
                                  {failedRun.job_type}: {failedRun.error ?? "error"}
                                </p>
                              ) : null}
                            </td>
                            <td>
                              <details className={styles.detailsBlock}>
                                <summary>script (preview)</summary>
                                <pre className={styles.scriptPre}>{buildScriptPreview(episode.script)}</pre>
                              </details>
                            </td>
                            <td>
                              {sources.length === 0 ? (
                                "-"
                              ) : (
                                <details className={styles.detailsBlock}>
                                  <summary>Sources ({sources.length})</summary>
                                  <ul className={styles.sourcesList}>
                                    {sources.map((source, index) => (
                                      <li key={`${episode.id}-source-${index}`}>
                                        <span>{source.source}</span>
                                        <span>{source.title}</span>
                                        {source.url ? (
                                          <a href={source.url} target="_blank" rel="noreferrer">
                                            {source.url}
                                          </a>
                                        ) : (
                                          <span>-</span>
                                        )}
                                      </li>
                                    ))}
                                  </ul>
                                </details>
                              )}
                            </td>
                            <td>
                              {episode.audio_url ? (
                                <audio controls preload="none" className={styles.audioPlayer} src={episode.audio_url} />
                              ) : (
                                "-"
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            );
          })}
        </div>
      )}
    </main>
  );
}
