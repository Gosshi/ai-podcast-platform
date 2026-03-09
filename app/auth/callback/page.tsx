"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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

export default function AuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const next = new URLSearchParams(window.location.search).get("next") || "/episodes";
    const supabase = createBrowserSupabaseClient();

    const finish = async () => {
      const synced = await syncServerSession();
      if (synced) {
        router.replace(next);
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
      }).then(() => {
        router.replace(next);
      });
    });

    return () => {
      subscription.subscription.unsubscribe();
    };
  }, [router]);

  return (
    <main style={{ maxWidth: 560, margin: "4rem auto", padding: "0 1rem" }}>
      <h1>ログインを確定しています</h1>
      <p>数秒以内に会員ページへ戻ります。</p>
      {error ? <p style={{ color: "#b91c1c" }}>{error}</p> : null}
    </main>
  );
}
