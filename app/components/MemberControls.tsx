"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import AnalyticsEventOnRender from "@/app/components/AnalyticsEventOnRender";
import {
  formatMembershipDate,
  resolveMembershipBadgeLabel,
  resolveMembershipStatusLabel,
  resolvePaymentStateLabel,
  resolvePlanName
} from "@/app/lib/membership";
import { buildLoginPath } from "@/app/lib/onboarding";
import type { ViewerState } from "@/app/lib/viewer";
import { track } from "@/src/lib/analytics";
import { createBrowserSupabaseClient } from "@/src/lib/supabase/browserClient";
import styles from "./member-controls.module.css";

type MemberControlsProps = {
  viewer: ViewerState | null;
  title?: string;
  copy?: string;
  showBillingPortal?: boolean;
  analyticsSource?: string;
  variant?: "full" | "compact";
  authRedirectPath?: string;
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

const shouldRefreshForAuthEvent = (event: AuthChangeEvent): boolean => {
  return event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED";
};

export default function MemberControls({
  viewer,
  title = "会員ステータス",
  copy = "無料版はタイトルとかんたんな説明まで。有料会員になると判断理由、次の行動、見直しタイミング、履歴分析が使えます。",
  showBillingPortal = false,
  analyticsSource,
  variant = "full",
  authRedirectPath = "/decisions"
}: MemberControlsProps) {
  const router = useRouter();
  const [email, setEmail] = useState(viewer?.email ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const latestViewerRef = useRef(viewer);
  const lastSyncedAccessTokenRef = useRef<string | null>(null);
  const isCompact = variant === "compact";

  useEffect(() => {
    latestViewerRef.current = viewer;
  }, [viewer]);

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    let isActive = true;

    void supabase.auth.getSession().then(async ({ data }) => {
      if (!isActive || !data.session) {
        return;
      }

      if (lastSyncedAccessTokenRef.current !== data.session.access_token) {
        await syncServerSession(data.session);
        lastSyncedAccessTokenRef.current = data.session.access_token;
      }

      if (!latestViewerRef.current) {
        startTransition(() => {
          router.refresh();
        });
      }
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isActive || event === "INITIAL_SESSION") {
        return;
      }

      if (session?.access_token && lastSyncedAccessTokenRef.current === session.access_token) {
        if (!shouldRefreshForAuthEvent(event)) {
          return;
        }
      }

      void syncServerSession(session).finally(() => {
        if (session?.access_token) {
          lastSyncedAccessTokenRef.current = session.access_token;
        } else {
          lastSyncedAccessTokenRef.current = null;
        }

        if (shouldRefreshForAuthEvent(event)) {
          startTransition(() => {
            router.refresh();
          });
        }
      });
    });

    return () => {
      isActive = false;
      subscription.subscription.unsubscribe();
    };
  }, [router]);

  const handleMagicLink = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setMessage(null);

    const supabase = createBrowserSupabaseClient();
    const origin = window.location.origin;
    const { error: signInError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(authRedirectPath)}`
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
    track("subscribe_cta_click", {
      page: analyticsSource,
      source: analyticsSource ? `member_controls:${analyticsSource}` : "member_controls"
    });

    const response = await fetch("/api/stripe/subscription-checkout", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        source: analyticsSource ?? null
      })
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

  const handleBillingPortal = async () => {
    setError(null);
    setMessage(null);

    const response = await fetch("/api/stripe/billing-portal", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        source: analyticsSource ?? null
      })
    });
    const payload = (await response.json().catch(() => ({}))) as {
      ok?: boolean;
      url?: string;
      error?: string;
    };

    if (!response.ok || payload.ok !== true || !payload.url) {
      setError(payload.error ?? "billing_portal_failed");
      return;
    }

    window.location.href = payload.url;
  };

  return (
    <section className={styles.panel}>
      {!viewer?.isPaid && analyticsSource ? (
        <AnalyticsEventOnRender
          eventName="paywall_view"
          properties={{
            page: analyticsSource,
            source: `member_controls:${analyticsSource}`
          }}
        />
      ) : null}

      {isCompact ? (
        <>
          <div className={styles.compactHeader}>
            <p className={styles.eyebrow}>アカウント</p>
            <span className={`${styles.badge} ${viewer?.isPaid ? styles.badgePaid : styles.badgeFree}`}>
              {resolveMembershipBadgeLabel(viewer?.isPaid ?? false)}
            </span>
          </div>
          <div className={styles.compactBody}>
            <div className={styles.header}>
              <h2 className={styles.title}>{title}</h2>
              <p className={styles.copy}>
                {viewer
                  ? viewer.isPaid
                  ? "結果まで残しながら、自分向けの判断精度を育てられます。"
                    : "無料版ではタイトルとかんたんな説明まで確認できます。詳しい設定はアカウントから管理できます。"
                  : "ログイン後は初回設定に進み、そのまま判断画面へ戻れます。"}
              </p>
            </div>
            <Link href={viewer ? "/account" : buildLoginPath(authRedirectPath)} className={styles.compactLink}>
              {viewer ? "アカウントを見る" : "ログイン"}
            </Link>
          </div>
        </>
      ) : (
        <>
          <div className={styles.header}>
            <p className={styles.eyebrow}>アカウント</p>
            <h2 className={styles.title}>{title}</h2>
            <p className={styles.copy}>{copy}</p>
          </div>

          <div className={styles.statusRow}>
            <span className={`${styles.badge} ${viewer?.isPaid ? styles.badgePaid : styles.badgeFree}`}>
              {resolveMembershipBadgeLabel(viewer?.isPaid ?? false)}
            </span>
            <span className={styles.meta}>
              {viewer?.email ? viewer.email : "未ログイン"}
            </span>
          </div>

          {viewer ? (
            <dl className={styles.detailGrid}>
              <div className={styles.detailItem}>
                <dt>プラン</dt>
                <dd>{resolvePlanName(viewer.planType, viewer.isPaid)}</dd>
              </div>
              <div className={styles.detailItem}>
                <dt>ステータス</dt>
                <dd>{resolveMembershipStatusLabel(viewer.subscriptionStatus, viewer.cancelAtPeriodEnd)}</dd>
              </div>
              <div className={styles.detailItem}>
                <dt>支払い状態</dt>
                <dd>{resolvePaymentStateLabel(viewer.subscriptionStatus)}</dd>
              </div>
              <div className={styles.detailItem}>
                <dt>次回更新日</dt>
                <dd>
                  {formatMembershipDate(viewer.currentPeriodEnd, "ja-JP", {
                    year: "numeric",
                    month: "short",
                    day: "numeric"
                  })}
                </dd>
              </div>
            </dl>
          ) : null}

          {viewer?.cancelAtPeriodEnd ? (
            <p className={styles.hint}>現在の期間が終わるまでは有料機能を利用できます。</p>
          ) : null}

          {viewer?.isPaid ? (
            <p className={styles.hint}>締切を逃しにくくなり、迷いを減らしながら判断を早く進められます。</p>
          ) : (
            <p className={styles.hint}>無料版はタイトルとかんたんな説明まで。有料会員で判断理由、次の行動、見直しタイミング、履歴分析が使えます。</p>
          )}

          {viewer ? (
            <div className={styles.actions}>
              {!viewer.isPaid ? (
                <button
                  type="button"
                  className={styles.primaryButton}
                  onClick={() => void handleSubscribe()}
                  disabled={isPending}
                >
                  有料会員になる
                </button>
              ) : null}
              {showBillingPortal && viewer.stripeCustomerId ? (
                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={() => void handleBillingPortal()}
                  disabled={isPending}
                >
                  サブスクを管理
                </button>
              ) : null}
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() => void handleSignOut()}
                disabled={isPending}
              >
                ログアウト
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
                  メールでログイン
                </button>
              </div>
              <p className={styles.hint}>ログイン後は初回設定に進み、そのまま判断画面へ戻れます。</p>
            </form>
          )}

          {message ? <p className={styles.message}>{message}</p> : null}
          {error ? <p className={`${styles.message} ${styles.error}`}>{error}</p> : null}
        </>
      )}
    </section>
  );
}
