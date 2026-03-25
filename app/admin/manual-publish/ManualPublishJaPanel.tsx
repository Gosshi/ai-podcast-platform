"use client";

import { useState } from "react";
import styles from "./page.module.css";

type ManualPublishResult = {
  ok: boolean;
  episodeId: string | null;
  status: string | null;
  publishedAt: string | null;
  audioUrl: string | null;
  durationSec: number | null;
  judgmentCardsCount: number;
  provider: string | null;
  permalink: string | null;
  error: string | null;
};

const isManualPublishResult = (value: unknown): value is ManualPublishResult => {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;

  return (
    typeof row.ok === "boolean" &&
    (typeof row.episodeId === "string" || row.episodeId === null) &&
    (typeof row.status === "string" || row.status === null) &&
    (typeof row.publishedAt === "string" || row.publishedAt === null) &&
    (typeof row.audioUrl === "string" || row.audioUrl === null) &&
    (typeof row.durationSec === "number" || row.durationSec === null) &&
    typeof row.judgmentCardsCount === "number" &&
    (typeof row.provider === "string" || row.provider === null) &&
    (typeof row.permalink === "string" || row.permalink === null) &&
    (typeof row.error === "string" || row.error === null)
  );
};

export default function ManualPublishJaPanel({
  defaultEpisodeDate
}: {
  defaultEpisodeDate: string;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [previewText, setPreviewText] = useState("");
  const [script, setScript] = useState("");
  const [episodeDate, setEpisodeDate] = useState(defaultEpisodeDate);
  const [genre, setGenre] = useState("tech");
  const [existingEpisodeId, setExistingEpisodeId] = useState("");
  const [publish, setPublish] = useState(true);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ManualPublishResult | null>(null);

  const onSubmit = async () => {
    setLoading(true);
    setResult(null);

    try {
      const response = await fetch("/api/admin/manual-publish-ja", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          title,
          description,
          previewText,
          script,
          episodeDate,
          genre,
          existingEpisodeId,
          publish,
          ttsFormat: "mp3"
        })
      });

      const json = (await response.json().catch(() => null)) as unknown;
      if (isManualPublishResult(json)) {
        setResult(json);
      } else {
        setResult({
          ok: false,
          episodeId: null,
          status: null,
          publishedAt: null,
          audioUrl: null,
          durationSec: null,
          judgmentCardsCount: 0,
          provider: null,
          permalink: null,
          error: `invalid_manual_publish_response:${response.status}`
        });
      }
    } catch (error) {
      setResult({
        ok: false,
        episodeId: null,
        status: null,
        publishedAt: null,
        audioUrl: null,
        durationSec: null,
        judgmentCardsCount: 0,
        provider: null,
        permalink: null,
        error: error instanceof Error ? error.message : "manual_publish_request_failed"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className={styles.panel}>
      <h2>Publish Form</h2>
      <div className={styles.formGrid}>
        <label className={styles.field}>
          <span>Title</span>
          <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="そのAIツール、今月も課金する？" />
        </label>

        <label className={styles.field}>
          <span>Episode Date</span>
          <input type="date" value={episodeDate} onChange={(event) => setEpisodeDate(event.target.value)} />
        </label>

        <label className={styles.field}>
          <span>Genre</span>
          <select value={genre} onChange={(event) => setGenre(event.target.value)}>
            <option value="tech">tech</option>
            <option value="general">general</option>
            <option value="entertainment">entertainment</option>
          </select>
        </label>

        <label className={styles.field}>
          <span>Existing Episode ID</span>
          <input
            value={existingEpisodeId}
            onChange={(event) => setExistingEpisodeId(event.target.value)}
            placeholder="optional"
          />
        </label>

        <label className={`${styles.field} ${styles.fieldFull}`}>
          <span>Description</span>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={4}
            placeholder="公開面の summary を入れる"
          />
        </label>

        <label className={`${styles.field} ${styles.fieldFull}`}>
          <span>Preview Text</span>
          <textarea
            value={previewText}
            onChange={(event) => setPreviewText(event.target.value)}
            rows={3}
            placeholder="未入力なら description から自動生成"
          />
        </label>

        <label className={`${styles.field} ${styles.fieldFull}`}>
          <span>Script</span>
          <textarea
            value={script}
            onChange={(event) => setScript(event.target.value)}
            rows={20}
            placeholder="[OP]\n...\n[DEEPDIVE 1]\n..."
          />
        </label>
      </div>

      <label className={styles.checkboxRow}>
        <input type="checkbox" checked={publish} onChange={(event) => setPublish(event.target.checked)} />
        <span>publish まで進める</span>
      </label>

      <div className={styles.actions}>
        <button
          type="button"
          onClick={onSubmit}
          disabled={loading || !title.trim() || !description.trim() || !script.trim() || !episodeDate}
        >
          {loading ? "Publishing..." : "Run Manual Publish"}
        </button>
      </div>

      {result ? (
        <div className={result.ok ? styles.resultSuccess : styles.resultError}>
          <p>{result.ok ? "manual publish completed" : `manual publish failed: ${result.error ?? "unknown_error"}`}</p>
          <dl className={styles.resultGrid}>
            <div>
              <dt>episodeId</dt>
              <dd>{result.episodeId ?? "-"}</dd>
            </div>
            <div>
              <dt>status</dt>
              <dd>{result.status ?? "-"}</dd>
            </div>
            <div>
              <dt>publishedAt</dt>
              <dd>{result.publishedAt ?? "-"}</dd>
            </div>
            <div>
              <dt>durationSec</dt>
              <dd>{result.durationSec ?? "-"}</dd>
            </div>
            <div>
              <dt>judgmentCards</dt>
              <dd>{result.judgmentCardsCount}</dd>
            </div>
            <div>
              <dt>provider</dt>
              <dd>{result.provider ?? "-"}</dd>
            </div>
          </dl>

          {result.audioUrl ? (
            <p>
              audio:{" "}
              <a href={result.audioUrl} target="_blank" rel="noreferrer noopener">
                {result.audioUrl}
              </a>
            </p>
          ) : null}
          {result.permalink ? (
            <p>
              episode:{" "}
              <a href={result.permalink} target="_blank" rel="noreferrer noopener">
                {result.permalink}
              </a>
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
