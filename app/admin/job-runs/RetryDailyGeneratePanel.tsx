"use client";

import { useState } from "react";
import { getMessages } from "@/src/lib/i18n/messages";
import type { Locale } from "@/src/lib/i18n/locale";
import styles from "./job-runs.module.css";

type RetryResponse = {
  ok: boolean;
  disabled?: boolean;
  episodeDate: string;
  runId: string | null;
  status: number;
  error: string | null;
};

const isRetryResponse = (value: unknown): value is RetryResponse => {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;

  return (
    typeof row.ok === "boolean" &&
    typeof row.episodeDate === "string" &&
    (typeof row.runId === "string" || row.runId === null) &&
    typeof row.status === "number" &&
    (typeof row.error === "string" || row.error === null || typeof row.error === "undefined")
  );
};

export default function RetryDailyGeneratePanel({
  defaultEpisodeDate,
  locale
}: {
  defaultEpisodeDate: string;
  locale: Locale;
}) {
  const [episodeDate, setEpisodeDate] = useState(defaultEpisodeDate);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RetryResponse | null>(null);

  const messageSet = getMessages(locale);
  const t = messageSet.jobRuns;

  const onRetry = async () => {
    setLoading(true);
    setResult(null);

    try {
      const response = await fetch("/api/admin/retry-daily-generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ episodeDate })
      });

      const json = (await response.json().catch(() => null)) as unknown;
      if (isRetryResponse(json)) {
        setResult(json);
      } else {
        setResult({
          ok: false,
          episodeDate,
          runId: null,
          status: response.status,
          error: "invalid_retry_response"
        });
      }
    } catch (error) {
      setResult({
        ok: false,
        episodeDate,
        runId: null,
        status: 0,
        error: error instanceof Error ? error.message : messageSet.common.unknownError
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className={styles.card}>
      <h2>{t.retryTitle}</h2>
      <p className={styles.caption}>{t.retryCaption}</p>

      <div className={styles.retryControls}>
        <label className={styles.retryLabel} htmlFor="episode-date-input">
          {t.episodeDate}
        </label>
        <input
          id="episode-date-input"
          type="date"
          value={episodeDate}
          onChange={(event) => setEpisodeDate(event.target.value)}
        />
        <button type="button" onClick={onRetry} disabled={loading || !episodeDate}>
          {loading ? t.retrying : t.retryButton}
        </button>
      </div>

      {result ? (
        <p className={result.ok ? styles.retrySuccess : styles.retryError}>
          {result.ok
            ? `${t.successPrefix}: ${t.invokedLabel} (run_id=${result.runId ?? "-"}, status=${result.status})`
            : result.disabled
              ? `${t.disabledPrefix}: ${result.error ?? t.retryDisabledFallback}`
              : `${t.failedPrefix}: ${result.error ?? t.retryFailedFallback} (status=${result.status}, run_id=${result.runId ?? "-"})`}
        </p>
      ) : null}
    </section>
  );
}
