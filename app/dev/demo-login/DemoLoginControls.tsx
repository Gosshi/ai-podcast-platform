"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import { createBrowserSupabaseClient } from "@/src/lib/supabase/browserClient";

type DemoUser = "free" | "paid";

type SessionState = {
  signedIn: boolean;
  email: string | null;
  isPaid: boolean;
  planType: string | null;
  subscriptionStatus: string | null;
};

type DemoLoginControlsProps = {
  initialSession: SessionState;
  requestedDemoUser?: DemoUser | null;
};

type DemoSwitchResponse =
  | {
      ok: true;
      demoUser: DemoUser;
      expectedEmail: string;
      redirectTo: string;
      accessToken: string;
      refreshToken: string;
    }
  | {
      ok: false;
      error: string;
      details?: string | null;
      session?: SessionState;
    };

const DEMO_CARDS: Record<
  DemoUser,
  {
    title: string;
    email: string;
    copy: string;
    buttonLabel: string;
    buttonColor: string;
  }
> = {
  free: {
    title: "FREE demo user",
    email: "demo-free@local.test",
    copy: "preview 制限、archive lock、free gating の確認用",
    buttonLabel: "FREE でログイン",
    buttonColor: "#0f172a"
  },
  paid: {
    title: "PAID demo user",
    email: "demo-paid@local.test",
    copy: "personal hint、full library、alerts、replay、profile の確認用",
    buttonLabel: "PAID でログイン",
    buttonColor: "#2563eb"
  }
};

const describeSession = (session: SessionState | null) => {
  if (!session?.signedIn) {
    return "現在の session は未ログインです。";
  }

  return `current: ${session.email ?? "-"} / ${session.isPaid ? "paid" : "free"} / ${session.planType ?? "-"}`;
};

export default function DemoLoginControls({ initialSession, requestedDemoUser = null }: DemoLoginControlsProps) {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<SessionState>(initialSession);
  const [pendingUser, setPendingUser] = useState<DemoUser | null>(null);
  const autoSwitchHandledRef = useRef<DemoUser | null>(null);

  const syncBrowserSession = async (payload: Extract<DemoSwitchResponse, { ok: true }>) => {
    const supabase = createBrowserSupabaseClient();
    const { data, error: sessionError } = await supabase.auth.setSession({
      access_token: payload.accessToken,
      refresh_token: payload.refreshToken
    });

    if (sessionError || !data.session) {
      throw new Error(sessionError?.message ?? "demo_session_sync_failed");
    }

    const syncResponse = await fetch("/api/auth/session", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token
      }),
      credentials: "same-origin"
    });

    if (!syncResponse.ok) {
      throw new Error("demo_cookie_sync_failed");
    }
  };

  const switchDemoUser = async (demoUser: DemoUser) => {
    if (pendingUser) {
      return;
    }

    setError(null);
    setMessage(`${demoUser.toUpperCase()} に切り替えています...`);
    setPendingUser(demoUser);

    try {
      const response = await fetch("/api/dev/demo-login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify({ demo: demoUser }),
        credentials: "same-origin"
      });
      const payload = (await response.json().catch(() => null)) as DemoSwitchResponse | null;
      if (!response.ok || !payload || !payload.ok) {
        const nextSession = payload && !payload.ok && payload.session ? payload.session : session;
        setSession(nextSession);
        throw new Error(
          [
            payload && !payload.ok ? payload.error : "demo_login_failed",
            payload && !payload.ok && payload.details ? payload.details : null,
            describeSession(nextSession)
          ]
            .filter(Boolean)
            .join(" / ")
        );
      }

      await syncBrowserSession(payload);

      const statusResponse = await fetch("/api/dev/demo-login?mode=status", {
        cache: "no-store",
        credentials: "same-origin",
        headers: {
          Accept: "application/json"
        }
      });
      const statusPayload = (await statusResponse.json().catch(() => null)) as
        | { ok: true; session: SessionState }
        | { ok: false }
        | null;

      if (!statusResponse.ok || !statusPayload || !statusPayload.ok) {
        throw new Error("demo_status_check_failed / cookie 更新後の状態確認に失敗しました。");
      }

      setSession(statusPayload.session);

      if (statusPayload.session.email !== payload.expectedEmail) {
        throw new Error(
          `demo_session_mismatch / expected=${payload.expectedEmail} actual=${statusPayload.session.email ?? "none"}`
        );
      }

      setMessage(
        `${demoUser.toUpperCase()} に切り替えました。${statusPayload.session.isPaid ? "paid" : "free"} gating を確認できます。`
      );
      window.location.assign(payload.redirectTo);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "demo_login_failed");
      setMessage(null);
    } finally {
      setPendingUser(null);
    }
  };

  const runAutoDemoSwitch = useEffectEvent((demoUser: DemoUser) => {
    void switchDemoUser(demoUser);
  });

  useEffect(() => {
    if (!requestedDemoUser || autoSwitchHandledRef.current === requestedDemoUser) {
      return;
    }

    autoSwitchHandledRef.current = requestedDemoUser;
    runAutoDemoSwitch(requestedDemoUser);
  }, [requestedDemoUser]);

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
        {(["free", "paid"] as const).map((demoUser) => {
          const config = DEMO_CARDS[demoUser];

          return (
            <div key={demoUser} style={{ display: "grid", gap: 12 }}>
              <div style={{ padding: 20, borderRadius: 18, background: "#f8fafc", border: "1px solid #cbd5e1" }}>
                <strong style={{ display: "block", marginBottom: 8 }}>{config.title}</strong>
                <div style={{ color: "#475569", fontSize: 14 }}>{config.email}</div>
                <div style={{ color: "#64748b", fontSize: 14, marginTop: 10 }}>{config.copy}</div>
              </div>
              <button
                type="button"
                onClick={() => {
                  void switchDemoUser(demoUser);
                }}
                disabled={Boolean(pendingUser)}
                style={{
                  border: 0,
                  borderRadius: 14,
                  padding: "14px 18px",
                  background: config.buttonColor,
                  color: "#fff",
                  fontSize: 15,
                  fontWeight: 700,
                  cursor: pendingUser ? "wait" : "pointer",
                  opacity: pendingUser && pendingUser !== demoUser ? 0.72 : 1
                }}
              >
                {pendingUser === demoUser ? "切り替え中..." : config.buttonLabel}
              </button>
            </div>
          );
        })}
      </div>

      <div
        style={{
          padding: 14,
          borderRadius: 14,
          border: "1px solid rgba(148, 163, 184, 0.24)",
          background: "rgba(248, 250, 252, 0.88)",
          display: "grid",
          gap: 8
        }}
      >
        <strong style={{ fontSize: 14 }}>session debug</strong>
        <div style={{ color: "#475569", fontSize: 14, lineHeight: 1.6 }}>{describeSession(session)}</div>
        {message ? <div style={{ color: "#0f766e", fontSize: 14, fontWeight: 700 }}>{message}</div> : null}
        {error ? <div style={{ color: "#b91c1c", fontSize: 14, fontWeight: 700 }}>{error}</div> : null}
      </div>
    </div>
  );
}
