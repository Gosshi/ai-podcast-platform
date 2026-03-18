"use client";

import { useCallback, useState } from "react";
import AudioPlayer from "./AudioPlayer";
import { track } from "@/src/lib/analytics";
import styles from "./post-listen-cta.module.css";

type PostListenCTAProps = {
  src: string | null;
  title: string;
  description?: string | null;
  cardsAnchorId?: string;
  hasCards: boolean;
  page: string;
  episodeId?: string;
};

export default function PostListenCTA({
  src,
  title,
  description,
  cardsAnchorId = "topic-cards",
  hasCards,
  page,
  episodeId
}: PostListenCTAProps) {
  const [showCTA, setShowCTA] = useState(false);

  const onEnded = useCallback(() => {
    setShowCTA(true);
    track("episode_listen_complete", {
      page,
      source: "audio_player",
      episode_id: episodeId
    });
  }, [page, episodeId]);

  const scrollToCards = () => {
    const el = document.getElementById(cardsAnchorId);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      track("post_listen_cta_click", {
        page,
        source: "post_listen_banner",
        episode_id: episodeId
      });
    }
  };

  return (
    <div>
      <AudioPlayer
        src={src}
        title={title}
        description={description}
        onEnded={onEnded}
      />

      {showCTA && hasCards ? (
        <div className={styles.banner}>
          <div className={styles.bannerContent}>
            <p className={styles.bannerTitle}>エピソードを聴き終わりました</p>
            <p className={styles.bannerText}>トピックカードで今日のポイントを確認しましょう。</p>
          </div>
          <button
            type="button"
            className={styles.bannerButton}
            onClick={scrollToCards}
          >
            カードを見る ↓
          </button>
        </div>
      ) : showCTA && !hasCards ? (
        <div className={styles.banner}>
          <p className={styles.bannerTitle}>エピソードを聴き終わりました</p>
        </div>
      ) : null}
    </div>
  );
}
