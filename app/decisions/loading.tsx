import styles from "./page.module.css";

export default function DecisionsLoading() {
  return (
    <main className={styles.page}>
      {/* Hero skeleton */}
      <section className={styles.playerHero}>
        <div className={styles.playerHeroMeta}>
          <p className={styles.eyebrow}>Today&apos;s Podcast</p>
          <div
            style={{
              height: "1rem",
              width: "60%",
              backgroundColor: "#e2e8f0",
              borderRadius: "0.25rem",
              animation: "pulse 1.5s ease-in-out infinite"
            }}
          />
        </div>
        {/* Audio player skeleton */}
        <div
          style={{
            height: "4.5rem",
            backgroundColor: "#f1f5f9",
            borderRadius: "0.75rem",
            animation: "pulse 1.5s ease-in-out infinite"
          }}
        />
      </section>

      {/* Topic cards skeleton */}
      <section style={{ marginTop: "1.5rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
          <div>
            <div
              style={{
                height: "0.75rem",
                width: "5rem",
                backgroundColor: "#e2e8f0",
                borderRadius: "0.25rem",
                marginBottom: "0.5rem"
              }}
            />
            <div
              style={{
                height: "1.25rem",
                width: "10rem",
                backgroundColor: "#e2e8f0",
                borderRadius: "0.25rem"
              }}
            />
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "0.75rem" }}>
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              style={{
                height: "12rem",
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
