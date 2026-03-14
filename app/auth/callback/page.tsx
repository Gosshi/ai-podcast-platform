"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { buildOnboardingPath, resolveSafeNextPath } from "@/app/lib/onboarding";
import { createBrowserSupabaseClient } from "@/src/lib/supabase/browserClient";

const syncServerSession = async (): Promise<boolean> => {
  const supabase = createBrowserSupabaseClient();
  const { data } = await supabase.auth.getSession();

  if (!data.session) {
    return false;
  }

  await fetch("/api/auth/session", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token
    })
  });

  return true;
};

const resolvePostAuthDestination = async (next: string): Promise<string> => {
  try {
    const response = await fetch("/api/user-preferences", {
      method: "GET"
    });

    if (!response.ok) {
      return next;
    }

    const payload = (await response.json().catch(() => ({}))) as {
      needsOnboarding?: boolean;
    };

    if (!payload.needsOnboarding) {
      return next;
    }

    return next.startsWith("/onboarding") ? next : buildOnboardingPath(next);
  } catch {
    return next;
  }
};

export default function AuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const next = resolveSafeNextPath(new URLSearchParams(window.location.search).get("next"), "/decisions");
    const supabase = createBrowserSupabaseClient();

    const finish = async () => {
      const synced = await syncServerSession();
      if (synced) {
        router.replace(await resolvePostAuthDestination(next));
        return;
      }
      setError("ログインセッションを確定できませんでした。");
    };

    void finish();

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        return;
      }

      void fetch("/api/auth/session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          accessToken: session.access_token,
          refreshToken: session.refresh_token
        })
      }).then(async () => {
        router.replace(await resolvePostAuthDestination(next));
      });
    });

    return () => {
      subscription.subscription.unsubscribe();
    };
  }, [router]);

  return (
    <main style={{ maxWidth: 560, margin: "4rem auto", padding: "0 1rem" }}>
      <h1>ログインを確定しています</h1>
      <p>数秒以内に前の画面へ戻ります。</p>
      {error ? <p style={{ color: "#b91c1c" }}>{error}</p> : null}
    </main>
  );
}
