import Link from "next/link";
import DemoLoginControls from "./DemoLoginControls";
import { getViewerFromCookies } from "@/app/lib/viewer";
import { resolveMembershipBadgeLabel } from "@/app/lib/membership";

type SearchParams = {
  error?: string | string[];
  details?: string | string[];
  demo?: string | string[];
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
  const details = readParam(params.details);
  const requestedDemoUser = readParam(params.demo);
  const viewer = await getViewerFromCookies();

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
          ローカル開発専用の入口です。seed 済み demo user でログインし、`/decisions` `/episodes` `/history`
          `/account` をそのまま確認できます。
        </p>

        {error ? (
          <div
            style={{
              marginBottom: 20,
              padding: "12px 14px",
              borderRadius: 12,
              background: "#fee2e2",
              color: "#991b1b",
              display: "grid",
              gap: 6
            }}
          >
            <strong>demo login failed: {error}</strong>
            {details ? <span style={{ fontSize: 14, lineHeight: 1.6 }}>{details}</span> : null}
          </div>
        ) : null}

        <section
          style={{
            marginBottom: 24,
            padding: 18,
            borderRadius: 18,
            border: "1px solid rgba(148, 163, 184, 0.24)",
            background: "rgba(248, 250, 252, 0.92)",
            display: "grid",
            gap: 10
          }}
        >
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
            <strong>現在の検証状態</strong>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                minHeight: 28,
                padding: "0 10px",
                borderRadius: 999,
                background: viewer ? "#dbeafe" : "#e2e8f0",
                color: "#0f172a",
                fontSize: 13,
                fontWeight: 700
              }}
            >
              {viewer ? resolveMembershipBadgeLabel(viewer.isPaid) : "未ログイン"}
            </span>
          </div>
          <div style={{ color: "#334155", fontSize: 14, lineHeight: 1.7 }}>
            {viewer ? (
              <>
                <div>email: {viewer.email ?? "-"}</div>
                <div>plan: {viewer.planType ?? "-"}</div>
                <div>subscription: {viewer.subscriptionStatus ?? "-"}</div>
              </>
            ) : (
              <div>現在は demo session が入っていません。</div>
            )}
          </div>
        </section>

        <DemoLoginControls
          initialSession={{
            signedIn: Boolean(viewer),
            email: viewer?.email ?? null,
            isPaid: viewer?.isPaid ?? false,
            planType: viewer?.planType ?? null,
            subscriptionStatus: viewer?.subscriptionStatus ?? null
          }}
          requestedDemoUser={requestedDemoUser === "free" || requestedDemoUser === "paid" ? requestedDemoUser : null}
        />

        <div style={{ marginTop: 24, display: "flex", gap: 16, flexWrap: "wrap" }}>
          <Link href="/account">Account</Link>
          <Link href="/decisions">Decisions</Link>
          <Link href="/episodes">Episodes</Link>
          <Link href="/history">History</Link>
          <Link href="/dev/demo-login?demo=free">FREEをURLで切替</Link>
          <Link href="/dev/demo-login?demo=paid">PAIDをURLで切替</Link>
        </div>
      </section>
    </main>
  );
}
