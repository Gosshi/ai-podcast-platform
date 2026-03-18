import styles from "./page.module.css";

export default function HistoryLoading() {
  return (
    <main className={styles.page}>
      {/* Hero skeleton */}
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>履歴</p>
          <h1>行動の記録と振り返り</h1>

          {/* Stats grid skeleton */}
          <div className={styles.statsGrid}>
            {["満足率", "実行数", "満足", "後悔", "未記録"].map((label) => (
              <article key={label} className={styles.statCard}>
                <span className={styles.statLabel}>{label}</span>
                <div
                  style={{
                    height: "1.5rem",
                    width: "3rem",
                    backgroundColor: "#e2e8f0",
                    borderRadius: "0.25rem",
                    animation: "pulse 1.5s ease-in-out infinite"
                  }}
                />
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Profile skeleton */}
      <section style={{ marginTop: "1.5rem" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "0.75rem" }}>
          {[1, 2].map((i) => (
            <div
              key={i}
              style={{
                height: "10rem",
                backgroundColor: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: "0.75rem",
                animation: "pulse 1.5s ease-in-out infinite",
                animationDelay: `${i * 0.15}s`
              }}
            />
          ))}
        </div>
      </section>

      {/* History list skeleton */}
      <section style={{ marginTop: "1.5rem" }}>
        <div style={{ marginBottom: "0.75rem" }}>
          <div style={{ height: "0.75rem", width: "4rem", backgroundColor: "#e2e8f0", borderRadius: "0.25rem", marginBottom: "0.5rem" }} />
          <div style={{ height: "1.25rem", width: "8rem", backgroundColor: "#e2e8f0", borderRadius: "0.25rem" }} />
        </div>
        <div style={{ display: "grid", gap: "0.5rem" }}>
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              style={{
                height: "8rem",
                backgroundColor: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: "0.75rem",
                animation: "pulse 1.5s ease-in-out infinite",
                animationDelay: `${i * 0.15}s`
              }}
            />
          ))}
        </div>
      </section>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </main>
  );
}
