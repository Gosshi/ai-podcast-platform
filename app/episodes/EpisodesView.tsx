"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { getMessages } from "@/src/lib/i18n/messages";
import type { Locale } from "@/src/lib/i18n/locale";
import { useLocale } from "@/src/lib/i18n/useLocale";
import styles from "./episodes.module.css";
import type { EpisodeRow, JobRunRow, ViewLang } from "./types";

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

type FailedRunIndex = {
  byEpisodeId: Map<string, JobRunRow>;
  unlinkedCount: number;
};

type EpisodesViewProps = {
  episodes: EpisodeRow[];
  failedRuns: JobRunRow[];
  initialLocale: Locale;
  initialViewLang: ViewLang;
  loadError: string | null;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const toTimestamp = (value: string): number => {
  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
};

const resolveDateValue = (episode: EpisodeRow): string => episode.published_at ?? episode.created_at;

const formatDateTime = (value: string | null, locale: Locale): string => {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString(locale === "ja" ? "ja-JP" : "en-US", {
    hour12: false
  });
};

const formatDateOnly = (value: string, locale: Locale): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(locale === "ja" ? "ja-JP" : "en-US");
};

const stripLangSuffix = (value: string | null): string => {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return "";
  return trimmed.replace(/\s*\((JA|EN)\)\s*$/i, "").trim() || trimmed;
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

const resolveGroupKey = (episode: EpisodeRow, masterIds: Set<string>): string => {
  if (episode.lang === "ja" && masterIds.has(episode.id)) {
    return `pair:${episode.id}`;
  }

  if (episode.lang === "en" && episode.master_id) {
    return `pair:${episode.master_id}`;
  }

  const topic = stripLangSuffix(episode.title).toLowerCase() || "untitled";
  return `topic:${resolveDateValue(episode).slice(0, 10)}:${topic}`;
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
    const dateValue = resolveDateValue(episode);
    const sortAt = toTimestamp(dateValue);

    const existing = groups.get(key);
    if (!existing) {
      groups.set(key, {
        key,
        topic: stripLangSuffix(episode.title),
        dateValue,
        sortAt,
        ...(episode.lang === "ja" ? { ja: episode } : { en: episode })
      });
      continue;
    }

    if (episode.lang === "ja") {
      existing.ja = existing.ja ?? episode;
    } else {
      existing.en = existing.en ?? episode;
    }

    if (!existing.topic && episode.title) {
      existing.topic = stripLangSuffix(episode.title);
    }

    if (sortAt > existing.sortAt) {
      existing.sortAt = sortAt;
      existing.dateValue = dateValue;
    }
  }

  return Array.from(groups.values()).sort((a, b) => b.sortAt - a.sortAt);
};

const pickEpisodesByViewLang = (group: EpisodeGroup, viewLang: ViewLang): EpisodeRow[] => {
  const rows = [group.ja, group.en].filter((episode): episode is EpisodeRow => Boolean(episode));
  if (viewLang === "all") return rows;
  return rows.filter((episode) => episode.lang === viewLang);
};

const findFailedRunForEpisode = (episode: EpisodeRow, failedRunIndex: FailedRunIndex): JobRunRow | null => {
  const ids = [episode.id, episode.master_id]
    .filter((id): id is string => Boolean(id))
    .map((id) => id.toLowerCase());

  for (const id of ids) {
    const run = failedRunIndex.byEpisodeId.get(id);
    if (run) return run;
  }

  return null;
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
    const matches = line.match(/https?:\/\/\S+/g);
    if (!matches) continue;

    for (const url of matches) {
      urls.add(url.trim());
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

  if (rowCount === 0) return [];

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

const resolveViewLang = (value: string | null, initialViewLang: ViewLang): ViewLang => {
  if (value === "ja" || value === "en") return value;
  if (value === "all") return value;
  return initialViewLang;
};

export default function EpisodesView({
  episodes,
  failedRuns,
  initialLocale,
  initialViewLang,
  loadError
}: EpisodesViewProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { locale, setLocale } = useLocale(initialLocale);
  const messageSet = getMessages(locale);
  const t = messageSet.episodes;

  const viewLang = resolveViewLang(searchParams.get("filter"), initialViewLang);
  const groups = useMemo(() => buildEpisodeGroups(episodes), [episodes]);
  const failedRunIndex = useMemo(() => buildFailedRunIndex(failedRuns), [failedRuns]);
  const episodesById = useMemo(() => new Map(episodes.map((episode) => [episode.id, episode])), [episodes]);

  const visibleGroups = useMemo(
    () => groups.filter((group) => pickEpisodesByViewLang(group, viewLang).length > 0),
    [groups, viewLang]
  );

  const visibleEpisodes = useMemo(
    () => visibleGroups.flatMap((group) => pickEpisodesByViewLang(group, viewLang)),
    [viewLang, visibleGroups]
  );

  const playableEpisodes = useMemo(
    () => visibleEpisodes.filter((episode) => Boolean(episode.audio_url)),
    [visibleEpisodes]
  );

  const [selectedEpisodeId, setSelectedEpisodeId] = useState<string | null>(null);
  const [activeEpisodeId, setActiveEpisodeId] = useState<string | null>(null);
  const [pendingAutoPlay, setPendingAutoPlay] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMiniPlayerHidden, setIsMiniPlayerHidden] = useState(false);
  const [playbackError, setPlaybackError] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const cardRefs = useRef(new Map<string, HTMLDivElement>());
  const lastManualScrollAt = useRef(0);

  useEffect(() => {
    if (visibleEpisodes.length === 0) {
      setSelectedEpisodeId(null);
      return;
    }

    if (!selectedEpisodeId || !visibleEpisodes.some((episode) => episode.id === selectedEpisodeId)) {
      setSelectedEpisodeId(visibleEpisodes[0].id);
    }
  }, [selectedEpisodeId, visibleEpisodes]);

  useEffect(() => {
    const markManualScroll = () => {
      lastManualScrollAt.current = Date.now();
    };

    window.addEventListener("scroll", markManualScroll, { passive: true });
    window.addEventListener("wheel", markManualScroll, { passive: true });
    window.addEventListener("touchmove", markManualScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", markManualScroll);
      window.removeEventListener("wheel", markManualScroll);
      window.removeEventListener("touchmove", markManualScroll);
    };
  }, []);

  useEffect(() => {
    if (!pendingAutoPlay) return;

    const audio = audioRef.current;
    if (!audio || !activeEpisodeId) {
      setPendingAutoPlay(false);
      return;
    }

    void audio
      .play()
      .then(() => {
        setPlaybackError(null);
      })
      .catch((error: unknown) => {
        setPlaybackError(error instanceof Error ? error.message : messageSet.common.unknownError);
      })
      .finally(() => {
        setPendingAutoPlay(false);
      });
  }, [activeEpisodeId, messageSet.common.unknownError, pendingAutoPlay]);

  const setViewLangFilter = useCallback(
    (nextViewLang: ViewLang) => {
      const params = new URLSearchParams(searchParams.toString());

      if (nextViewLang === "all") {
        params.delete("filter");
      } else {
        params.set("filter", nextViewLang);
      }

      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  const registerCardRef = useCallback((episodeId: string, node: HTMLDivElement | null) => {
    if (node) {
      cardRefs.current.set(episodeId, node);
      return;
    }

    cardRefs.current.delete(episodeId);
  }, []);

  const scrollToEpisodeCard = useCallback((episodeId: string, force: boolean) => {
    const target = cardRefs.current.get(episodeId);
    if (!target) return;

    if (!force && Date.now() - lastManualScrollAt.current < 700) {
      return;
    }

    target.scrollIntoView({
      behavior: "smooth",
      block: "center"
    });
  }, []);

  const startEpisodePlayback = useCallback(
    (episode: EpisodeRow) => {
      if (!episode.audio_url) return;

      setPlaybackError(null);
      setSelectedEpisodeId(episode.id);

      const audio = audioRef.current;
      const shouldAutoScroll = Date.now() - lastManualScrollAt.current >= 700;

      if (activeEpisodeId === episode.id && audio) {
        if (audio.paused) {
          void audio.play().catch((error: unknown) => {
            setPlaybackError(error instanceof Error ? error.message : messageSet.common.unknownError);
          });
        } else {
          audio.pause();
        }

        if (shouldAutoScroll) {
          scrollToEpisodeCard(episode.id, false);
        }

        return;
      }

      setActiveEpisodeId(episode.id);
      setPendingAutoPlay(true);

      if (shouldAutoScroll) {
        scrollToEpisodeCard(episode.id, false);
      }
    },
    [activeEpisodeId, messageSet.common.unknownError, scrollToEpisodeCard]
  );

  const selectedEpisode = selectedEpisodeId ? episodesById.get(selectedEpisodeId) ?? null : null;
  const activeEpisode = activeEpisodeId ? episodesById.get(activeEpisodeId) ?? null : null;
  const selectedScript = useMemo(() => {
    const polished = selectedEpisode?.script_polished?.trim() ?? "";
    if (polished) {
      return {
        text: polished,
        isPolished: true
      };
    }

    const original = selectedEpisode?.script?.trim() ?? "";
    return {
      text: original || null,
      isPolished: false
    };
  }, [selectedEpisode?.script, selectedEpisode?.script_polished]);

  const selectedSources = useMemo(
    () => extractSources(selectedScript.text),
    [selectedScript.text]
  );

  const activePlayableIndex = useMemo(
    () => playableEpisodes.findIndex((episode) => episode.id === activeEpisodeId),
    [activeEpisodeId, playableEpisodes]
  );

  const playRelative = useCallback(
    (delta: number) => {
      if (activePlayableIndex < 0) return;

      const target = playableEpisodes[activePlayableIndex + delta];
      if (!target) return;

      setSelectedEpisodeId(target.id);
      setActiveEpisodeId(target.id);
      setPendingAutoPlay(true);
      scrollToEpisodeCard(target.id, true);
    },
    [activePlayableIndex, playableEpisodes, scrollToEpisodeCard]
  );

  const tabItems: { value: ViewLang; label: string }[] = [
    { value: "all", label: t.filterAll },
    { value: "ja", label: t.filterJa },
    { value: "en", label: t.filterEn }
  ];

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1>{t.pageTitle}</h1>
          <p className={styles.caption}>{t.caption}</p>
        </div>

        <div className={styles.topControls}>
          <div className={styles.controlBlock}>
            <span className={styles.controlLabel}>{t.localeLabel}</span>
            <div className={styles.toggleGroup} role="group" aria-label={t.localeLabel}>
              <button
                type="button"
                className={`${styles.toggleButton} ${locale === "ja" ? styles.toggleActive : ""}`.trim()}
                onClick={() => setLocale("ja")}
              >
                {messageSet.common.languageJa}
              </button>
              <button
                type="button"
                className={`${styles.toggleButton} ${locale === "en" ? styles.toggleActive : ""}`.trim()}
                onClick={() => setLocale("en")}
              >
                {messageSet.common.languageEn}
              </button>
            </div>
          </div>

          <div className={styles.controlBlock}>
            <span className={styles.controlLabel}>{t.filterLabel}</span>
            <div className={styles.toggleGroup} role="group" aria-label={t.filterLabel}>
              {tabItems.map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setViewLangFilter(tab.value)}
                  className={`${styles.toggleButton} ${viewLang === tab.value ? styles.toggleActive : ""}`.trim()}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      {loadError ? (
        <p className={styles.errorText}>
          {t.errorPrefix}: {loadError}
        </p>
      ) : null}

      {failedRuns.length > 0 ? (
        <p className={styles.failureSummary}>
          {t.failedRunsSummary}: {failedRuns.length}
          {failedRunIndex.unlinkedCount > 0 ? ` (${t.unlinked}: ${failedRunIndex.unlinkedCount})` : ""}
        </p>
      ) : null}

      {visibleGroups.length === 0 ? (
        <p>{t.empty}</p>
      ) : (
        <div className={styles.contentGrid}>
          <section className={styles.groupList}>
            {visibleGroups.map((group) => {
              const rows = pickEpisodesByViewLang(group, viewLang);

              return (
                <article key={group.key} className={styles.groupCard}>
                  <header className={styles.groupHeader}>
                    <h2>{group.topic || t.untitled}</h2>
                    <p>{formatDateOnly(group.dateValue, locale)}</p>
                  </header>

                  <div className={styles.episodeList}>
                    {rows.map((episode) => {
                      const isSelected = selectedEpisodeId === episode.id;
                      const isPlayingCard = isPlaying && activeEpisodeId === episode.id;
                      const failedRun =
                        episode.status === "failed"
                          ? findFailedRunForEpisode(episode, failedRunIndex)
                          : null;
                      const statusLabel = episode.status === "failed"
                        ? t.statusFailed
                        : !episode.audio_url
                          ? t.statusPending
                          : episode.published_at
                            ? t.statusPublished
                            : t.statusReady;

                      return (
                        <div
                          key={episode.id}
                          ref={(node) => registerCardRef(episode.id, node)}
                          className={`${styles.episodeCard} ${
                            isPlayingCard ? styles.episodeCardPlaying : isSelected ? styles.episodeCardSelected : ""
                          }`.trim()}
                        >
                          <div className={styles.episodeMetaRow}>
                            <span className={styles.langBadge}>{episode.lang.toUpperCase()}</span>
                            <span className={styles.statusBadge}>{statusLabel}</span>
                            {isPlayingCard ? <span className={styles.liveBadge}>{t.activeBadge}</span> : null}
                            {!isPlayingCard && isSelected ? <span className={styles.liveBadge}>{t.selectedBadge}</span> : null}
                          </div>

                          <h3>{episode.title ?? t.untitled}</h3>

                          <p className={styles.episodeMetaText}>
                            {t.publishedAt}: {formatDateTime(episode.published_at, locale)}
                          </p>
                          <p className={styles.episodeMetaText}>
                            {t.createdAt}: {formatDateTime(episode.created_at, locale)}
                          </p>

                          {failedRun ? (
                            <p className={styles.failureDetail}>
                              {failedRun.job_type}: {failedRun.error ?? messageSet.common.unknownError}
                            </p>
                          ) : null}

                          <div className={styles.episodeActions}>
                            <button
                              type="button"
                              onClick={() => startEpisodePlayback(episode)}
                              disabled={!episode.audio_url}
                              className={styles.primaryButton}
                            >
                              {isPlayingCard ? t.pause : t.play}
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                setSelectedEpisodeId((current) => (current === episode.id ? null : episode.id))
                              }
                              className={styles.secondaryButton}
                            >
                              {isSelected ? t.hideScript : t.viewScript}
                            </button>
                          </div>

                          {!episode.audio_url ? <p className={styles.noAudio}>{t.noAudio}</p> : null}
                        </div>
                      );
                    })}
                  </div>
                </article>
              );
            })}
          </section>

          <aside className={styles.detailPanel}>
            <h2>{t.detailsTitle}</h2>

            {selectedEpisode ? (
              <div className={styles.detailBody}>
                <h3>{selectedEpisode.title ?? t.untitled}</h3>
                <p>
                  {t.language}: {selectedEpisode.lang.toUpperCase()}
                </p>
                <p>
                  {t.status}: {selectedEpisode.status}
                </p>

                <section>
                  <h4>{selectedScript.isPolished ? t.scriptPolished : t.script}</h4>
                  {selectedScript.text ? (
                    <pre className={styles.scriptPre}>{selectedScript.text}</pre>
                  ) : (
                    <p>{t.noScript}</p>
                  )}
                </section>

                <section>
                  <h4>{t.sources}</h4>
                  {selectedSources.length === 0 ? (
                    <p>{t.noSources}</p>
                  ) : (
                    <ul className={styles.sourcesList}>
                      {selectedSources.map((source, index) => (
                        <li key={`${selectedEpisode.id}-source-${index}`}>
                          <strong>{t.sourceName}:</strong> {source.source}
                          <br />
                          <strong>{t.sourceTitle}:</strong> {source.title}
                          <br />
                          <strong>{t.sourceUrl}:</strong>{" "}
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
                  )}
                </section>
              </div>
            ) : (
              <p>{t.detailsPlaceholder}</p>
            )}
          </aside>
        </div>
      )}

      {isMiniPlayerHidden ? (
        <button
          type="button"
          className={styles.showPlayerButton}
          onClick={() => setIsMiniPlayerHidden(false)}
        >
          {t.showPlayer}
        </button>
      ) : (
        <section className={styles.miniPlayer}>
          <div className={styles.miniPlayerHeader}>
            <div className={styles.miniPlayerMeta}>
              <p className={styles.miniPlayerLabel}>{t.audioPlayerTitle}</p>
              {activeEpisode ? (
                <>
                  <h2>{activeEpisode.title ?? t.untitled}</h2>
                  <p>
                    {activeEpisode.lang.toUpperCase()} / {isPlaying ? t.nowPlaying : t.paused}
                  </p>
                </>
              ) : (
                <p>{t.nothingPlaying}</p>
              )}
            </div>

            <button
              type="button"
              className={styles.closePlayerButton}
              onClick={() => setIsMiniPlayerHidden(true)}
              aria-label={t.hidePlayer}
            >
              ×
            </button>
          </div>

          <div className={styles.miniPlayerActions}>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() => playRelative(-1)}
              disabled={activePlayableIndex <= 0}
            >
              {t.previous}
            </button>

            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() => playRelative(1)}
              disabled={activePlayableIndex < 0 || activePlayableIndex >= playableEpisodes.length - 1}
            >
              {t.next}
            </button>

            <button
              type="button"
              className={styles.primaryButton}
              onClick={() => {
                if (!activeEpisodeId) return;
                scrollToEpisodeCard(activeEpisodeId, true);
              }}
              disabled={!activeEpisodeId}
            >
              {t.moveToPlaying}
            </button>
          </div>

          <audio
            ref={audioRef}
            controls
            preload="metadata"
            src={activeEpisode?.audio_url ?? undefined}
            className={styles.audioPlayer}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onEnded={() => setIsPlaying(false)}
            onError={() => setPlaybackError(messageSet.common.unknownError)}
          />

          {playbackError ? <p className={styles.errorText}>{playbackError}</p> : null}
        </section>
      )}
    </main>
  );
}
