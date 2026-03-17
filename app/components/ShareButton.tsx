"use client";

import { useCallback, useState } from "react";
import { track } from "@/src/lib/analytics";
import styles from "./share-button.module.css";

type ShareButtonProps = {
  title: string;
  text?: string;
  url: string;
  page: string;
  source: string;
  episodeId?: string;
};

export default function ShareButton({ title, text, url, page, source, episodeId }: ShareButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleShare = useCallback(async () => {
    const shareData = { title, text: text ?? title, url };

    track("share_click", {
      page,
      source,
      episode_id: episodeId,
      method: typeof navigator.share === "function" ? "native" : "clipboard"
    });

    if (typeof navigator.share === "function") {
      try {
        await navigator.share(shareData);
        track("share_complete", { page, source, episode_id: episodeId, method: "native" });
        return;
      } catch {
        // User cancelled or share failed — fall through to clipboard
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      track("share_complete", { page, source, episode_id: episodeId, method: "clipboard" });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable
    }
  }, [title, text, url, page, source, episodeId]);

  return (
    <button type="button" className={styles.button} onClick={() => void handleShare()}>
      <svg className={styles.icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7" />
        <polyline points="16 6 12 2 8 6" />
        <line x1="12" y1="2" x2="12" y2="15" />
      </svg>
      <span>{copied ? "コピーしました" : "シェア"}</span>
    </button>
  );
}
