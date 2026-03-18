import styles from "./page.module.css";

export default function AccountLoading() {
  return (
    <div className={styles.page}>
      <div className={styles.shell}>
        {/* Hero skeleton */}
        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <div
              style={{
                height: "0.75rem",
                width: "4rem",
                backgroundColor: "var(--color-border-light, #e2e8f0)",
                borderRadius: "0.25rem",
                animation: "pulse 1.5s ease-in-out infinite"
              }}
            />
            <div
              style={{
                height: "2rem",
                width: "12rem",
                backgroundColor: "var(--color-border-light, #e2e8f0)",
                borderRadius: "0.25rem",
                animation: "pulse 1.5s ease-in-out infinite"
              }}
            />
            <div
              style={{
                height: "1rem",
                width: "20rem",
                backgroundColor: "var(--color-border-light, #e2e8f0)",
                borderRadius: "0.25rem",
                animation: "pulse 1.5s ease-in-out infinite"
              }}
            />
          </div>
          {/* Membership card skeleton */}
          <div
            style={{
              height: "12rem",
              backgroundColor: "var(--color-bg-card, #ffffff)",
              border: "1px solid var(--color-border-light, #e2e8f0)",
              borderRadius: "0.75rem",
              animation: "pulse 1.5s ease-in-out infinite"
            }}
          />
        </section>

        {/* Preferences skeleton */}
        <div
          style={{
            height: "8rem",
            backgroundColor: "var(--color-bg-card, #ffffff)",
            border: "1px solid var(--color-border-light, #e2e8f0)",
            borderRadius: "0.75rem",
            animation: "pulse 1.5s ease-in-out infinite",
            animationDelay: "0.15s"
          }}
        />

        {/* Alerts skeleton */}
        <div
          style={{
            height: "10rem",
            backgroundColor: "var(--color-bg-card, #ffffff)",
            border: "1px solid var(--color-border-light, #e2e8f0)",
            borderRadius: "0.75rem",
            animation: "pulse 1.5s ease-in-out infinite",
            animationDelay: "0.3s"
          }}
        />
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}
