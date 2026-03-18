import styles from "./episodes.module.css";

export default function EpisodesLoading() {
  return (
    <main className={styles.page}>
      {/* Header skeleton */}
      <div className={styles.header}>
        <div>
          <div
            style={{
              height: "1.75rem",
              width: "10rem",
              backgroundColor: "var(--color-border-light, #e2e8f0)",
              borderRadius: "0.25rem",
              animation: "pulse 1.5s ease-in-out infinite"
            }}
          />
          <div
            style={{
              height: "0.875rem",
              width: "16rem",
              backgroundColor: "var(--color-border-light, #e2e8f0)",
              borderRadius: "0.25rem",
              marginTop: "0.5rem",
              animation: "pulse 1.5s ease-in-out infinite"
            }}
          />
        </div>
      </div>

      {/* Filter controls skeleton */}
      <div
        style={{
          display: "flex",
          gap: "0.5rem",
          flexWrap: "wrap"
        }}
      >
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            style={{
              height: "2rem",
              width: "5rem",
              backgroundColor: "var(--color-bg-subtle, #f1f5f9)",
              borderRadius: "0.5rem",
              animation: "pulse 1.5s ease-in-out infinite",
              animationDelay: `${i * 0.1}s`
            }}
          />
        ))}
      </div>

      {/* Episode list skeleton */}
      <div style={{ display: "grid", gap: "0.75rem" }}>
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            style={{
              height: "6rem",
              backgroundColor: "var(--color-bg-card, #ffffff)",
              border: "1px solid var(--color-border-light, #e2e8f0)",
              borderRadius: "0.75rem",
              animation: "pulse 1.5s ease-in-out infinite",
              animationDelay: `${i * 0.15}s`
            }}
          />
        ))}
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </main>
  );
}
