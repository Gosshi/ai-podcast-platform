"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./audio-player.module.css";

type AudioPlayerProps = {
  src: string | null;
  title: string;
  description?: string | null;
  onEnded?: () => void;
};

const RATES = [1, 1.25, 1.5, 1.75, 2] as const;

const formatTime = (seconds: number): string => {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
};

const storageKey = (src: string) => `audio-pos:${src}`;

export default function AudioPlayer({ src, title, description, onEnded }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showRemaining, setShowRemaining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Restore saved position on load
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !src) return;

    const saved = localStorage.getItem(storageKey(src));
    if (saved) {
      const pos = parseFloat(saved);
      if (Number.isFinite(pos) && pos > 0) {
        audio.currentTime = pos;
      }
    }
  }, [src]);

  // Persist position periodically
  useEffect(() => {
    if (!src || !isPlaying) return;

    const interval = setInterval(() => {
      const audio = audioRef.current;
      if (audio && audio.currentTime > 0) {
        localStorage.setItem(storageKey(src), String(audio.currentTime));
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [src, isPlaying]);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !src) return;
    if (audio.paused) {
      audio.play().catch(() => setError("再生に失敗しました"));
    } else {
      audio.pause();
    }
  }, [src]);

  const skip = useCallback((delta: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Math.max(0, Math.min(audio.currentTime + delta, audio.duration || 0));
  }, []);

  const cycleRate = useCallback(() => {
    const next = RATES[(RATES.indexOf(playbackRate as (typeof RATES)[number]) + 1) % RATES.length];
    setPlaybackRate(next);
    if (audioRef.current) audioRef.current.playbackRate = next;
  }, [playbackRate]);

  const seekTo = useCallback((clientX: number) => {
    const bar = progressRef.current;
    const audio = audioRef.current;
    if (!bar || !audio || !duration) return;
    const rect = bar.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    audio.currentTime = ratio * duration;
    setCurrentTime(ratio * duration);
  }, [duration]);

  // Mouse events for progress bar
  const handleProgressMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    isDraggingRef.current = true;
    seekTo(e.clientX);

    const onMouseMove = (ev: MouseEvent) => {
      if (isDraggingRef.current) seekTo(ev.clientX);
    };
    const onMouseUp = () => {
      isDraggingRef.current = false;
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }, [seekTo]);

  // Touch events for progress bar
  const handleProgressTouchStart = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    isDraggingRef.current = true;
    seekTo(e.touches[0].clientX);

    const onTouchMove = (ev: TouchEvent) => {
      if (isDraggingRef.current) seekTo(ev.touches[0].clientX);
    };
    const onTouchEnd = () => {
      isDraggingRef.current = false;
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
    };
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onTouchEnd);
  }, [seekTo]);

  // Keyboard navigation on progress bar
  const handleProgressKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowRight") { skip(5); e.preventDefault(); }
    else if (e.key === "ArrowLeft") { skip(-5); e.preventDefault(); }
  }, [skip]);

  // Audio event listeners
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => {
      if (!isDraggingRef.current) setCurrentTime(audio.currentTime);
    };
    const onLoadedMetadata = () => setDuration(audio.duration);
    const onPlay = () => { setIsPlaying(true); setIsBuffering(false); setError(null); };
    const onPause = () => setIsPlaying(false);
    const onEndedHandler = () => {
      setIsPlaying(false);
      if (src) localStorage.removeItem(storageKey(src));
      onEnded?.();
    };
    const onError = () => setError("音声の読み込みに失敗しました");
    const onWaiting = () => setIsBuffering(true);
    const onCanPlay = () => setIsBuffering(false);

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEndedHandler);
    audio.addEventListener("error", onError);
    audio.addEventListener("waiting", onWaiting);
    audio.addEventListener("canplay", onCanPlay);

    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEndedHandler);
      audio.removeEventListener("error", onError);
      audio.removeEventListener("waiting", onWaiting);
      audio.removeEventListener("canplay", onCanPlay);
    };
  }, [onEnded, src]);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const remaining = duration - currentTime;

  if (!src) {
    return (
      <div className={styles.player}>
        <div className={styles.noAudio}>
          <p>エピソードの音声はまだ準備中です</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.player}>
      <audio ref={audioRef} preload="metadata" src={src} />

      <div className={styles.meta}>
        <p className={styles.nowPlaying}>Now Playing</p>
        <h2 className={styles.title}>{title}</h2>
        {description ? <p className={styles.description}>{description}</p> : null}
      </div>

      <div className={styles.controls}>
        <button
          type="button"
          className={styles.skipBtn}
          onClick={() => skip(-15)}
          aria-label="15秒戻る"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12.5 8.14v-3.4l-4.5 4 4.5 4v-3.4a5.2 5.2 0 1 1-5 5.16" />
          </svg>
          <span>15</span>
        </button>

        <button
          type="button"
          className={`${styles.playBtn} ${isBuffering ? styles.playBtnBuffering : ""}`.trim()}
          onClick={togglePlay}
          aria-label={isBuffering ? "読み込み中" : isPlaying ? "一時停止" : "再生"}
        >
          {isBuffering ? (
            <svg className={styles.spinner} viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2.5" strokeDasharray="50 20" />
            </svg>
          ) : isPlaying ? (
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <rect x="6" y="5" width="4" height="14" rx="1" />
              <rect x="14" y="5" width="4" height="14" rx="1" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M7 5.5v13l11-6.5z" />
            </svg>
          )}
        </button>

        <button
          type="button"
          className={styles.skipBtn}
          onClick={() => skip(30)}
          aria-label="30秒進む"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M11.5 8.14v-3.4l4.5 4-4.5 4v-3.4a5.2 5.2 0 1 0 5 5.16" />
          </svg>
          <span>30</span>
        </button>
      </div>

      <div className={styles.progressArea}>
        <span className={styles.time}>{formatTime(currentTime)}</span>
        <div
          ref={progressRef}
          className={styles.progressBar}
          onMouseDown={handleProgressMouseDown}
          onTouchStart={handleProgressTouchStart}
          onKeyDown={handleProgressKeyDown}
          role="slider"
          aria-label="再生位置"
          aria-valuenow={Math.round(progress)}
          aria-valuemin={0}
          aria-valuemax={100}
          tabIndex={0}
        >
          <div className={styles.progressFill} style={{ width: `${progress}%` }} />
          <div className={styles.progressThumb} style={{ left: `${progress}%` }} />
        </div>
        <button
          type="button"
          className={styles.timeBtn}
          onClick={() => setShowRemaining(!showRemaining)}
          aria-label={showRemaining ? "残り時間を表示中" : "合計時間を表示中"}
        >
          {showRemaining ? `-${formatTime(remaining)}` : formatTime(duration)}
        </button>
      </div>

      <div className={styles.extras}>
        <button
          type="button"
          className={styles.rateBtn}
          onClick={cycleRate}
          aria-label={`再生速度 ${playbackRate}x`}
        >
          {playbackRate}x
        </button>
      </div>

      {error ? <p className={styles.error} role="alert">{error}</p> : null}
    </div>
  );
}
