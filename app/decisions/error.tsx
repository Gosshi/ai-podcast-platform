"use client";

import { useEffect } from "react";
import styles from "./page.module.css";

export default function DecisionsError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Decisions page error:", error);
  }, [error]);

  return (
    <main className={styles.page}>
      <section className={styles.playerHero}>
        <div className={styles.playerHeroMeta}>
          <p className={styles.eyebrow}>Today&apos;s Podcast</p>
          <p className={styles.playerHeroLead}>エラーが発生しました</p>
        </div>
      </section>
      <div style={{ textAlign: "center", padding: "2rem 0" }}>
        <p style={{ color: "#475569", marginBottom: "1rem" }}>
          エピソードの読み込みに失敗しました。時間をおいて再度お試しください。
        </p>
        <button
          onClick={reset}
          style={{
            padding: "0.6rem 1.5rem",
            fontSize: "0.95rem",
            fontWeight: 600,
            color: "#fff",
            backgroundColor: "#0f172a",
            border: "none",
            borderRadius: "0.5rem",
            cursor: "pointer"
          }}
        >
          再試行
        </button>
      </div>
    </main>
  );
}
