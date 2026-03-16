"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./audio-player.module.css";

type AudioPlayerProps = {
  src: string | null;
  title: string;
  description?: string | null;
  onEnded?: () => void;
};

export default function AudioPlayer({ src, title, description, onEnded }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const formatTime = (seconds: number): string => {
    if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

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
    const rates = [1, 1.25, 1.5, 1.75, 2];
    const next = rates[(rates.indexOf(playbackRate) + 1) % rates.length];
    setPlaybackRate(next);
    if (audioRef.current) audioRef.current.playbackRate = next;
  }, [playbackRate]);

  const handleProgressClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const bar = progressRef.current;
    const audio = audioRef.current;
    if (!bar || !audio || !duration) return;
    const rect = bar.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    audio.currentTime = ratio * duration;
  }, [duration]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onLoadedMetadata = () => setDuration(audio.duration);
    const onPlay = () => { setIsPlaying(true); setError(null); };
    const onPause = () => setIsPlaying(false);
    const onEndedHandler = () => { setIsPlaying(false); onEnded?.(); };
    const onError = () => setError("音声の読み込みに失敗しました");

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEndedHandler);
    audio.addEventListener("error", onError);

    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEndedHandler);
      audio.removeEventListener("error", onError);
    };
  }, [onEnded]);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

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
          className={styles.playBtn}
          onClick={togglePlay}
          aria-label={isPlaying ? "一時停止" : "再生"}
        >
          {isPlaying ? (
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
          onClick={handleProgressClick}
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
        <span className={styles.time}>{formatTime(duration)}</span>
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

      {error ? <p className={styles.error}>{error}</p> : null}
    </div>
  );
}
