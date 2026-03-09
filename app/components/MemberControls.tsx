"use client";

import { useEffect, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import type { ViewerState } from "@/app/lib/viewer";
import { createBrowserSupabaseClient } from "@/src/lib/supabase/browserClient";
import styles from "./member-controls.module.css";

type MemberControlsProps = {
  viewer: ViewerState | null;
  title?: string;
  copy?: string;
};

const syncServerSession = async (session: Session | null): Promise<void> => {
  if (!session) {
    await fetch("/api/auth/session", {
      method: "DELETE"
    });
    return;
  }

  await fetch("/api/auth/session", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      accessToken: session.access_token,
      refreshToken: session.refresh_token
    })
  });
};

const formatDate = (value: string | null): string => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("ja-JP");
};

export default function MemberControls({
  viewer,
  title = "会員ステータス",
  copy = "無料版はプレビューまで。有料会員になると判断カード、DeepDive全文、アーカイブが開放されます。"
}: MemberControlsProps) {
  const router = useRouter();
  const [email, setEmail] = useState(viewer?.email ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();

    void supabase.auth.getSession().then(async ({ data }) => {
      if (data.session) {
        await syncServerSession(data.session);
        if (!viewer) {
          startTransition(() => {
            router.refresh();
          });
        }
      }
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      void syncServerSession(session).finally(() => {
        startTransition(() => {
          router.refresh();
        });
      });
    });

    return () => {
      subscription.subscription.unsubscribe();
    };
  }, [router, viewer]);

  const handleMagicLink = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setMessage(null);

    const supabase = createBrowserSupabaseClient();
    const origin = window.location.origin;
    const { error: signInError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent("/episodes")}`
      }
    });

    if (signInError) {
      setError(signInError.message);
      return;
    }

    setMessage("ログインリンクをメールで送信しました。");
  };

  const handleSignOut = async () => {
    setError(null);
    setMessage(null);
    const supabase = createBrowserSupabaseClient();
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) {
      setError(signOutError.message);
      return;
    }
    setMessage("ログアウトしました。");
  };

  const handleSubscribe = async () => {
    setError(null);
    setMessage(null);

    const response = await fetch("/api/stripe/subscription-checkout", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      }
    });
    const payload = (await response.json().catch(() => ({}))) as {
      ok?: boolean;
      url?: string;
      error?: string;
    };

    if (!response.ok || payload.ok !== true || !payload.url) {
      setError(payload.error ?? "subscription_checkout_failed");
      return;
    }

    window.location.href = payload.url;
  };

  return (
    <section className={styles.panel}>
      <div className={styles.header}>
        <p className={styles.eyebrow}>Membership MVP</p>
        <h2 className={styles.title}>{title}</h2>
        <p className={styles.copy}>{copy}</p>
      </div>

      <div className={styles.statusRow}>
        <span className={`${styles.badge} ${viewer?.isPaid ? styles.badgePaid : styles.badgeFree}`}>
          {viewer?.isPaid ? "PAID" : "FREE"}
        </span>
        <span className={styles.meta}>
          {viewer?.email ? viewer.email : "未ログイン"}
        </span>
        {viewer?.subscriptionStatus ? (
          <span className={styles.meta}>
            {viewer.planType ?? "pro_monthly"} / {viewer.subscriptionStatus} / 次回期限 {formatDate(viewer.currentPeriodEnd)}
          </span>
        ) : null}
      </div>

      {viewer ? (
        <div className={styles.actions}>
          {!viewer.isPaid ? (
            <button
              type="button"
              className={styles.primaryButton}
              onClick={() => void handleSubscribe()}
              disabled={isPending}
            >
              Subscribe
            </button>
          ) : null}
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={() => void handleSignOut()}
            disabled={isPending}
          >
            Sign out
          </button>
        </div>
      ) : (
        <form className={styles.form} onSubmit={(event) => void handleMagicLink(event)}>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className={styles.input}
            placeholder="you@example.com"
            required
          />
          <div className={styles.actions}>
            <button type="submit" className={styles.primaryButton} disabled={isPending}>
              Magic Linkでログイン
            </button>
          </div>
          <p className={styles.hint}>Supabase Auth のメールOTPを使います。</p>
        </form>
      )}

      {message ? <p className={styles.message}>{message}</p> : null}
      {error ? <p className={`${styles.message} ${styles.error}`}>{error}</p> : null}
    </section>
  );
}
