"use client";

import styles from "./affiliate-card.module.css";

type AffiliateCardProps = {
  name: string;
  description: string;
  url: string;
  episodeId?: string;
  source?: string;
};

export default function AffiliateCard({ name, description, url, episodeId, source }: AffiliateCardProps) {
  const trackingUrl = new URL(url);
  if (episodeId) trackingUrl.searchParams.set("ref_episode", episodeId);
  trackingUrl.searchParams.set("ref_source", source ?? "handan");

  return (
    <div className={styles.card}>
      <span className={styles.label}>おすすめ</span>
      <a
        href={trackingUrl.toString()}
        target="_blank"
        rel="noopener noreferrer sponsored"
        className={styles.link}
      >
        <strong className={styles.name}>{name}</strong>
        <span className={styles.description}>{description}</span>
        <span className={styles.arrow}>&rarr;</span>
      </a>
    </div>
  );
}
