import Link from "next/link";

type SearchParams = {
  error?: string | string[];
};

const readParam = (value: string | string[] | undefined): string | null => {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
};

export default async function DemoLoginPage({
  searchParams
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const error = readParam(params.error);

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "48px 20px",
        background:
          "linear-gradient(180deg, rgba(242,245,236,1) 0%, rgba(233,238,246,1) 52%, rgba(248,244,234,1) 100%)"
      }}
    >
      <section
        style={{
          width: "min(720px, 100%)",
          background: "rgba(255,255,255,0.88)",
          border: "1px solid rgba(30,41,59,0.08)",
          borderRadius: 24,
          padding: 32,
          boxShadow: "0 24px 80px rgba(15, 23, 42, 0.08)"
        }}
      >
        <p style={{ margin: 0, fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase", color: "#475569" }}>
          Local Demo Login
        </p>
        <h1 style={{ marginTop: 12, marginBottom: 12, fontSize: "clamp(32px, 5vw, 44px)", lineHeight: 1.05 }}>
          free / paid をすぐ切り替えて検証する
        </h1>
        <p style={{ marginTop: 0, marginBottom: 24, color: "#334155", lineHeight: 1.7 }}>
          ローカル開発専用の入口です。seed 済み demo user でログインし、`/decisions` `/library` `/history`
          `/watchlist` `/alerts` `/account` をそのまま確認できます。
        </p>

        {error ? (
          <p
            style={{
              marginBottom: 20,
              padding: "12px 14px",
              borderRadius: 12,
              background: "#fee2e2",
              color: "#991b1b"
            }}
          >
            demo login failed: {error}
          </p>
        ) : null}

        <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
          <form action="/api/dev/demo-login" method="post" style={{ display: "grid", gap: 12 }}>
            <input type="hidden" name="user" value="free" />
            <div style={{ padding: 20, borderRadius: 18, background: "#f8fafc", border: "1px solid #cbd5e1" }}>
              <strong style={{ display: "block", marginBottom: 8 }}>FREE demo user</strong>
              <div style={{ color: "#475569", fontSize: 14 }}>demo-free@local.test</div>
              <div style={{ color: "#64748b", fontSize: 14, marginTop: 10 }}>
                preview 制限、archive lock、free gating の確認用
              </div>
            </div>
            <button
              type="submit"
              style={{
                border: 0,
                borderRadius: 14,
                padding: "14px 18px",
                background: "#0f172a",
                color: "#fff",
                fontSize: 15,
                cursor: "pointer"
              }}
            >
              FREE でログイン
            </button>
          </form>

          <form action="/api/dev/demo-login" method="post" style={{ display: "grid", gap: 12 }}>
            <input type="hidden" name="user" value="paid" />
            <div style={{ padding: 20, borderRadius: 18, background: "#f8fafc", border: "1px solid #cbd5e1" }}>
              <strong style={{ display: "block", marginBottom: 8 }}>PAID demo user</strong>
              <div style={{ color: "#475569", fontSize: 14 }}>demo-paid@local.test</div>
              <div style={{ color: "#64748b", fontSize: 14, marginTop: 10 }}>
                personal hint、full library、alerts、replay、profile の確認用
              </div>
            </div>
            <button
              type="submit"
              style={{
                border: 0,
                borderRadius: 14,
                padding: "14px 18px",
                background: "#2563eb",
                color: "#fff",
                fontSize: 15,
                cursor: "pointer"
              }}
            >
              PAID でログイン
            </button>
          </form>
        </div>

        <div style={{ marginTop: 24, display: "flex", gap: 16, flexWrap: "wrap" }}>
          <Link href="/account">Account</Link>
          <Link href="/decisions">Decisions</Link>
          <Link href="/history">History</Link>
          <Link href="/alerts">Alerts</Link>
        </div>
      </section>
    </main>
  );
}
