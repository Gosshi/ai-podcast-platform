import styles from "./page.module.css";

export default function DecisionDetailLoading() {
  return (
    <main className={styles.page}>
      {/* Back link skeleton */}
      <div className={styles.backRow}>
        <div
          style={{
            height: "1rem",
            width: "6rem",
            backgroundColor: "var(--color-border-light, #e2e8f0)",
            borderRadius: "0.25rem",
            animation: "pulse 1.5s ease-in-out infinite"
          }}
        />
      </div>

      {/* Hero skeleton */}
      <div className={styles.hero}>
        <div>
          {/* Title skeleton */}
          <div
            style={{
              height: "2rem",
              width: "70%",
              backgroundColor: "var(--color-border-light, #e2e8f0)",
              borderRadius: "0.25rem",
              animation: "pulse 1.5s ease-in-out infinite"
            }}
          />
          {/* Badges skeleton */}
          <div
            style={{
              display: "flex",
              gap: "0.5rem",
              marginTop: "0.75rem"
            }}
          >
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                style={{
                  height: "1.5rem",
                  width: "4rem",
                  backgroundColor: "var(--color-bg-subtle, #f1f5f9)",
                  borderRadius: "9999px",
                  animation: "pulse 1.5s ease-in-out infinite",
                  animationDelay: `${i * 0.1}s`
                }}
              />
            ))}
          </div>
          {/* Summary skeleton */}
          <div
            style={{
              height: "3rem",
              width: "100%",
              backgroundColor: "var(--color-bg-subtle, #f1f5f9)",
              borderRadius: "0.5rem",
              marginTop: "1rem",
              animation: "pulse 1.5s ease-in-out infinite"
            }}
          />
        </div>
        {/* Card sidebar skeleton */}
        <div
          style={{
            height: "16rem",
            backgroundColor: "var(--color-bg-card, #ffffff)",
            border: "1px solid var(--color-border-light, #e2e8f0)",
            borderRadius: "0.75rem",
            animation: "pulse 1.5s ease-in-out infinite",
            animationDelay: "0.15s"
          }}
        />
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
