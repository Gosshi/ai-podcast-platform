import Link from "next/link";
import { createServiceRoleClient } from "@/app/lib/supabaseClients";
import { resolveLocale } from "@/src/lib/i18n/locale";
import { getMessages } from "@/src/lib/i18n/messages";
import RetryDailyGeneratePanel from "./RetryDailyGeneratePanel";
import styles from "./job-runs.module.css";

export const dynamic = "force-dynamic";

type JobStatus = "running" | "success" | "failed" | "skipped";

type JobRunRow = {
  id: string;
  job_type: string;
  status: JobStatus;
  payload: unknown;
  error: string | null;
  created_at: string;
  started_at: string | null;
  ended_at: string | null;
};

type EpisodeLang = "ja" | "en";

type EpisodeStatus = "draft" | "queued" | "generating" | "ready" | "published" | "failed";

type EpisodeRow = {
  id: string;
  master_id: string | null;
  lang: EpisodeLang;
  status: EpisodeStatus;
  title: string | null;
  published_at: string | null;
  created_at: string;
};

type SearchParams = {
  status?: string | string[];
  lang?: string | string[];
};

type RequestEcho = {
  episodeDate: string;
  genre: string;
  force: boolean;
};

type RunGroup = {
  key: string;
  rootRunId: string | null;
  idempotencyKey: string | null;
  episodeDate: string | null;
  requestEcho: RequestEcho | null;
  decision: string | null;
  startedAt: string | null;
  endedAt: string | null;
  steps: JobRunRow[];
  relatedEpisodeIds: Set<string>;
};

type RunGroupView = {
  key: string;
  rootRunId: string | null;
  idempotencyKey: string | null;
  episodeDate: string | null;
  requestEcho: RequestEcho | null;
  decision: string | null;
  startedAt: string | null;
  endedAt: string | null;
  status: JobStatus;
  elapsedLabel: string;
  steps: JobRunRow[];
  relatedEpisodeIds: string[];
  relatedEpisodes: EpisodeRow[];
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const JOB_ORDER = [
  "daily-generate",
  "plan-topics",
  "write-script-ja",
  "tts-ja",
  "adapt-script-en",
  "tts-en",
  "publish"
] as const;
const JOB_PRIORITY = new Map<string, number>(JOB_ORDER.map((job, index) => [job, index]));

const readFirstParam = (value: string | string[] | undefined): string | undefined => {
  if (Array.isArray(value)) return value[0];
  return value;
};

const formatDateTime = (value: string | null, locale: "ja" | "en"): string => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(locale === "ja" ? "ja-JP" : "en-US", { hour12: false });
};

const formatElapsed = (startedAt: string | null, endedAt: string | null): string => {
  if (!startedAt) return "-";

  const startMs = Date.parse(startedAt);
  const endMs = endedAt ? Date.parse(endedAt) : Date.now();
  if (Number.isNaN(startMs) || Number.isNaN(endMs)) return "-";

  const elapsedMs = Math.max(0, endMs - startMs);
  const seconds = elapsedMs / 1000;

  if (seconds < 60) return `${seconds.toFixed(1)}s`;

  const minutes = Math.floor(seconds / 60);
  const remainSeconds = Math.round(seconds % 60)
    .toString()
    .padStart(2, "0");
  return `${minutes}m ${remainSeconds}s`;
};

const resolveJstTodayDate = (): string => {
  const now = new Date();
  const shifted = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const year = shifted.getUTCFullYear();
  const month = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const day = String(shifted.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatPayload = (payload: unknown): string => {
  try {
    return JSON.stringify(payload ?? {}, null, 2);
  } catch {
    return String(payload ?? "");
  }
};

const toMillis = (value: string | null): number => {
  if (!value) return 0;
  const millis = Date.parse(value);
  return Number.isNaN(millis) ? 0 : millis;
};

const normalizePayload = (payload: unknown): Record<string, unknown> => {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return {};
  }

  return payload as Record<string, unknown>;
};

const readPayloadString = (payload: unknown, key: string): string | null => {
  const value = normalizePayload(payload)[key];
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const readPayloadEpisodeDate = (payload: unknown): string | null => {
  const value = readPayloadString(payload, "episodeDate");
  if (!value || !DATE_PATTERN.test(value)) {
    return null;
  }

  return value;
};

const readPayloadRequestEcho = (payload: unknown): RequestEcho | null => {
  const raw = normalizePayload(payload).requestEcho;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }

  const record = raw as Record<string, unknown>;
  const episodeDate = typeof record.episodeDate === "string" ? record.episodeDate : null;
  const genre = typeof record.genre === "string" ? record.genre : null;
  const force = typeof record.force === "boolean" ? record.force : null;
  if (!episodeDate || !DATE_PATTERN.test(episodeDate) || !genre || force === null) {
    return null;
  }

  return {
    episodeDate,
    genre,
    force
  };
};

const readPayloadDecision = (payload: unknown): string | null => {
  const value = readPayloadString(payload, "decision");
  if (!value) return null;
  return value;
};

const formatRequestEcho = (requestEcho: RequestEcho | null): string => {
  if (!requestEcho) return "-";
  return `episodeDate=${requestEcho.episodeDate}, genre=${requestEcho.genre}, force=${requestEcho.force}`;
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

const extractEpisodeIds = (payload: unknown): string[] => {
  const ids = new Set<string>();
  collectUuids(payload, ids);
  return Array.from(ids);
};

const resolveRunStatus = (steps: JobRunRow[]): JobStatus => {
  if (steps.some((step) => step.status === "failed")) {
    return "failed";
  }

  if (steps.some((step) => step.status === "running")) {
    return "running";
  }

  if (steps.length > 0 && steps.every((step) => step.status === "skipped")) {
    return "skipped";
  }

  return "success";
};

const sortSteps = (steps: JobRunRow[]): JobRunRow[] => {
  return [...steps].sort((a, b) => {
    const timeDelta = toMillis(a.started_at ?? a.created_at) - toMillis(b.started_at ?? b.created_at);
    if (timeDelta !== 0) return timeDelta;

    const leftOrder = JOB_PRIORITY.get(a.job_type) ?? Number.MAX_SAFE_INTEGER;
    const rightOrder = JOB_PRIORITY.get(b.job_type) ?? Number.MAX_SAFE_INTEGER;
    if (leftOrder !== rightOrder) return leftOrder - rightOrder;

    return a.job_type.localeCompare(b.job_type);
  });
};

const buildRunGroups = (rows: JobRunRow[]): RunGroupView[] => {
  const sortedRows = [...rows].sort(
    (a, b) => toMillis(a.started_at ?? a.created_at) - toMillis(b.started_at ?? b.created_at)
  );

  const dailyRefs = sortedRows
    .filter((row) => row.job_type === "daily-generate")
    .map((row) => ({
      id: row.id,
      idempotencyKey: readPayloadString(row.payload, "idempotencyKey"),
      episodeDate: readPayloadEpisodeDate(row.payload),
      startedAtMs: toMillis(row.started_at ?? row.created_at)
    }));

  const grouped = new Map<string, RunGroup>();

  for (const row of sortedRows) {
    const idempotencyKey = readPayloadString(row.payload, "idempotencyKey");
    const episodeDate = readPayloadEpisodeDate(row.payload);
    const rowStartedAt = row.started_at ?? row.created_at;
    const rowStartedAtMs = toMillis(rowStartedAt);

    let key = `single:${row.id}`;
    let rootRunId: string | null = null;

    if (row.job_type === "daily-generate") {
      key = `daily:${row.id}`;
      rootRunId = row.id;
    } else if (idempotencyKey) {
      const linkedDaily = dailyRefs
        .filter((candidate) => {
          if (candidate.idempotencyKey !== idempotencyKey) return false;
          if (episodeDate && candidate.episodeDate && candidate.episodeDate !== episodeDate) return false;
          return candidate.startedAtMs <= rowStartedAtMs;
        })
        .at(-1);

      if (linkedDaily) {
        key = `daily:${linkedDaily.id}`;
        rootRunId = linkedDaily.id;
      } else {
        key = `orphan:${idempotencyKey}:${episodeDate ?? "unknown"}`;
      }
    }

    const existing = grouped.get(key);
    const group: RunGroup =
      existing ??
      ({
        key,
        rootRunId,
        idempotencyKey,
        episodeDate,
        requestEcho: null,
        decision: null,
        startedAt: rowStartedAt,
        endedAt: row.ended_at,
        steps: [],
        relatedEpisodeIds: new Set<string>()
      } satisfies RunGroup);

    if (!group.rootRunId && rootRunId) {
      group.rootRunId = rootRunId;
    }

    if (!group.idempotencyKey && idempotencyKey) {
      group.idempotencyKey = idempotencyKey;
    }

    if (!group.episodeDate && episodeDate) {
      group.episodeDate = episodeDate;
    }

    const requestEcho = readPayloadRequestEcho(row.payload);
    if (!group.requestEcho && requestEcho) {
      group.requestEcho = requestEcho;
    }

    const decision = readPayloadDecision(row.payload);
    if (!group.decision && decision) {
      group.decision = decision;
    }

    if (!group.startedAt || toMillis(rowStartedAt) < toMillis(group.startedAt)) {
      group.startedAt = rowStartedAt;
    }

    if (row.ended_at && (!group.endedAt || toMillis(row.ended_at) > toMillis(group.endedAt))) {
      group.endedAt = row.ended_at;
    }

    group.steps.push(row);

    for (const episodeId of extractEpisodeIds(row.payload)) {
      group.relatedEpisodeIds.add(episodeId);
    }

    grouped.set(key, group);
  }

  return Array.from(grouped.values())
    .map((group) => {
      const steps = sortSteps(group.steps);
      const status = resolveRunStatus(steps);
      const endedAt = status === "running" ? null : group.endedAt;

      return {
        key: group.key,
        rootRunId: group.rootRunId,
        idempotencyKey: group.idempotencyKey,
        episodeDate: group.episodeDate,
        requestEcho: group.requestEcho,
        decision: group.decision,
        startedAt: group.startedAt,
        endedAt,
        status,
        elapsedLabel: formatElapsed(group.startedAt, endedAt),
        steps,
        relatedEpisodeIds: Array.from(group.relatedEpisodeIds),
        relatedEpisodes: []
      } satisfies RunGroupView;
    })
    .sort((a, b) => toMillis(b.startedAt) - toMillis(a.startedAt));
};

const loadAuditData = async (): Promise<{
  jobRuns: JobRunRow[];
  episodes: EpisodeRow[];
  error: string | null;
}> => {
  try {
    const supabase = createServiceRoleClient();

    const { data: runRows, error: runError } = await supabase
      .from("job_runs")
      .select("id, job_type, status, payload, error, created_at, started_at, ended_at")
      .order("created_at", { ascending: false })
      .limit(400);

    if (runError) {
      return { jobRuns: [], episodes: [], error: runError.message };
    }

    const { data: episodeRows, error: episodeError } = await supabase
      .from("episodes")
      .select("id, master_id, lang, status, title, published_at, created_at")
      .in("lang", ["ja", "en"])
      .order("created_at", { ascending: false })
      .limit(40);

    if (episodeError) {
      return {
        jobRuns: (runRows as JobRunRow[]) ?? [],
        episodes: [],
        error: `failed to load episodes: ${episodeError.message}`
      };
    }

    return {
      jobRuns: (runRows as JobRunRow[]) ?? [],
      episodes: (episodeRows as EpisodeRow[]) ?? [],
      error: null
    };
  } catch (error) {
    return {
      jobRuns: [],
      episodes: [],
      error: error instanceof Error ? error.message : "unknown_error"
    };
  }
};

export default async function JobRunsPage({
  searchParams
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const locale = resolveLocale(readFirstParam(params.lang));
  const messageSet = getMessages(locale);
  const t = messageSet.jobRuns;
  const failedOnly = readFirstParam(params.status) === "failed";
  const { jobRuns, episodes, error } = await loadAuditData();

  const episodeById = new Map(episodes.map((episode) => [episode.id.toLowerCase(), episode]));

  const groupedRuns = buildRunGroups(jobRuns)
    .map((group) => ({
      ...group,
      relatedEpisodes: group.relatedEpisodeIds
        .map((id) => episodeById.get(id.toLowerCase()))
        .filter((episode): episode is EpisodeRow => Boolean(episode))
    }))
    .filter((group) => (failedOnly ? group.status === "failed" : true));

  const runCountByEpisodeId = new Map<string, number>();
  for (const group of groupedRuns) {
    for (const episodeId of new Set(group.relatedEpisodeIds.map((id) => id.toLowerCase()))) {
      runCountByEpisodeId.set(episodeId, (runCountByEpisodeId.get(episodeId) ?? 0) + 1);
    }
  }

  const defaultEpisodeDate = resolveJstTodayDate();

  const buildHref = (status: "failed" | null): string => {
    const query = new URLSearchParams();

    if (status) {
      query.set("status", status);
    }

    if (locale !== "ja") {
      query.set("lang", locale);
    }

    const queryText = query.toString();
    return queryText ? `/admin/job-runs?${queryText}` : "/admin/job-runs";
  };

  return (
    <main className={styles.page}>
      {/* TODO: add auth guard before enabling outside local-only operation. */}
      <h1>{t.pageTitle}</h1>
      <p className={styles.caption}>{t.caption}</p>
      <p className={styles.filter}>
        <Link href="/admin/trends">/admin/trends</Link>
      </p>

      <p className={styles.filter}>
        {t.filterPrefix}: {failedOnly ? t.filterFailedOnly : t.filterAll} [
        {" "}
        {failedOnly ? <Link href={buildHref(null)}>{t.showAll}</Link> : <Link href={buildHref("failed")}>{t.showFailedOnly}</Link>}
        ]
      </p>

      <RetryDailyGeneratePanel defaultEpisodeDate={defaultEpisodeDate} locale={locale} />

      {error ? <p className={styles.errorText}>{t.loadErrorPrefix}: {error}</p> : null}

      <section className={styles.card}>
        <h2>{t.recentEpisodes}</h2>
        {episodes.length === 0 ? (
          <p>{t.noEpisodes}</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>{t.created}</th>
                  <th>{t.title}</th>
                  <th>{t.lang}</th>
                  <th>{t.status}</th>
                  <th>{t.publishedAt}</th>
                  <th>{t.relatedRuns}</th>
                </tr>
              </thead>
              <tbody>
                {episodes.map((episode) => (
                  <tr key={episode.id}>
                    <td>{formatDateTime(episode.created_at, locale)}</td>
                    <td>{episode.title ?? "-"}</td>
                    <td>{episode.lang.toUpperCase()}</td>
                    <td>{episode.status}</td>
                    <td>{formatDateTime(episode.published_at, locale)}</td>
                    <td>{runCountByEpisodeId.get(episode.id.toLowerCase()) ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {groupedRuns.length === 0 ? (
        <p>{t.noGroupedRuns}</p>
      ) : (
        <div className={styles.groupList}>
          {groupedRuns.map((group) => (
            <section
              key={group.key}
              className={`${styles.runCard} ${group.status === "failed" ? styles.runCardFailed : ""}`.trim()}
            >
              <header className={styles.runHeader}>
                <div>
                  <h2>
                    {t.run} {group.rootRunId ? <code>{group.rootRunId}</code> : <span>{t.orphanGroup}</span>}
                  </h2>
                  <p>
                    {t.runStatus}=<strong>{group.status}</strong> / {t.started}={formatDateTime(group.startedAt, locale)} / {t.elapsed}=
                    {group.elapsedLabel}
                  </p>
                  <p>
                    {t.idempotencyKey}={group.idempotencyKey ?? "-"} / {t.episodeDate}={group.episodeDate ?? "-"}
                  </p>
                  <p>decision={group.decision ?? "-"} / requestEcho={formatRequestEcho(group.requestEcho)}</p>
                </div>
              </header>

              {group.relatedEpisodes.length > 0 ? (
                <p className={styles.relatedEpisodes}>
                  {t.relatedEpisodes}: {" "}
                  {group.relatedEpisodes
                    .map((episode) => `${episode.lang.toUpperCase()}:${episode.title ?? episode.id}`)
                    .join(" | ")}
                </p>
              ) : null}

              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>{t.step}</th>
                      <th>{t.status}</th>
                      <th>{t.started}</th>
                      <th>{t.elapsed}</th>
                      <th>{t.error}</th>
                      <th>{t.details}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.steps.map((step) => (
                      <tr key={step.id}>
                        <td>{step.job_type}</td>
                        <td>
                          <span
                            className={`${styles.statusBadge} ${
                              step.status === "failed"
                                ? styles.statusFailed
                                : step.status === "running"
                                  ? styles.statusRunning
                                  : step.status === "skipped"
                                    ? styles.statusSkipped
                                  : styles.statusSuccess
                            }`.trim()}
                          >
                            {step.status}
                          </span>
                        </td>
                        <td>{formatDateTime(step.started_at, locale)}</td>
                        <td>{formatElapsed(step.started_at, step.status === "running" ? null : step.ended_at)}</td>
                        <td className={styles.errorCell}>{step.error ?? "-"}</td>
                        <td>
                          <details>
                            <summary>{t.payload}</summary>
                            <pre className={styles.payloadPre}>{formatPayload(step.payload)}</pre>
                          </details>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
