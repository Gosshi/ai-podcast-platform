"use client";

import { useEffect } from "react";
import styles from "./page.module.css";

export default function HistoryError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("History page error:", error);
  }, [error]);

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>履歴</p>
          <h1>行動の記録と振り返り</h1>
        </div>
      </section>
      <div style={{ textAlign: "center", padding: "2rem 0" }}>
        <p style={{ color: "#475569", marginBottom: "1rem" }}>
          履歴の読み込みに失敗しました。時間をおいて再度お試しください。
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
