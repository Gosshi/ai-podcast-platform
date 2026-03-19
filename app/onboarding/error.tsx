"use client";

import { useEffect } from "react";

export default function OnboardingError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Onboarding page error:", error);
  }, [error]);

  return (
    <main
      style={{
        width: "min(640px, calc(100vw - 2rem))",
        margin: "4rem auto",
        textAlign: "center",
        fontFamily: "system-ui, sans-serif"
      }}
    >
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "0.75rem" }}>
        エラーが発生しました
      </h1>
      <p style={{ color: "#475569", lineHeight: 1.6, marginBottom: "1.5rem" }}>
        設定画面の読み込みに失敗しました。時間をおいて再度お試しください。
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
    </main>
  );
}
