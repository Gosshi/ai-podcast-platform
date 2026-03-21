"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import styles from "./page.module.css";

type AdminAccessFormProps = {
  nextPath: string;
};

const formatLockMessage = (lockedUntil: string | null | undefined): string => {
  if (!lockedUntil) {
    return "試行回数の上限に達しました。時間をおいて再試行してください。";
  }

  const date = new Date(lockedUntil);
  const formatted = Number.isNaN(date.getTime())
    ? lockedUntil
    : date.toLocaleString("ja-JP", { hour12: false });

  return `試行回数の上限に達しました。${formatted} までロックされています。`;
};

export default function AdminAccessForm({ nextPath }: AdminAccessFormProps) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [hasRequestedCode, setHasRequestedCode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetFeedback = () => {
    setError(null);
    setMessage(null);
  };

  const requestCode = async () => {
    resetFeedback();
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/admin/access", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          action: "request_code",
          next: nextPath
        })
      });

      const payload = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        sent?: boolean;
        error?: string;
        lockedUntil?: string | null;
        retryAfterSeconds?: number;
      };

      if (!response.ok || payload.ok !== true || payload.sent !== true) {
        if (payload.error === "admin_access_locked") {
          setError(formatLockMessage(payload.lockedUntil));
        } else if (payload.error === "code_resend_cooldown") {
          const seconds = typeof payload.retryAfterSeconds === "number" ? payload.retryAfterSeconds : 0;
          setError(`確認コードは再送直後です。${seconds} 秒ほど待ってから再試行してください。`);
        } else {
          setError("確認コードを送信できませんでした。");
        }
        return;
      }

      setHasRequestedCode(true);
      setMessage("確認コードを登録済みメールアドレスに送信しました。");
    } catch {
      setError("確認コードを送信できませんでした。");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    resetFeedback();
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/admin/access", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          action: "verify_code",
          code,
          next: nextPath
        })
      });

      const payload = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        next?: string;
        error?: string;
        remainingAttempts?: number;
        lockedUntil?: string | null;
      };

      if (!response.ok || payload.ok !== true || !payload.next) {
        if (payload.error === "admin_access_locked") {
          setError(formatLockMessage(payload.lockedUntil));
        } else if (payload.error === "code_expired") {
          setHasRequestedCode(false);
          setError("確認コードの有効期限が切れました。もう一度コードを送信してください。");
        } else {
          const attempts = typeof payload.remainingAttempts === "number" ? payload.remainingAttempts : null;
          setError(
            attempts !== null
              ? `確認コードが違います。残り ${attempts} 回です。`
              : "確認コードを確認できませんでした。"
          );
        }
        return;
      }

      setMessage("管理者アクセスを確認しました。");
      router.push(payload.next!);
      router.refresh();
    } catch {
      setError("確認コードを確認できませんでした。");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <label className={styles.field}>
        <span>確認コード</span>
        <input
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          placeholder="メールで届いた 6 桁のコード"
          required
          disabled={isSubmitting}
        />
      </label>

      {error ? <p className={styles.errorText}>{error}</p> : null}
      {message ? <p className={styles.successText}>{message}</p> : null}

      <div className={styles.actions}>
        <button type="button" className={styles.secondaryButton} disabled={isSubmitting} onClick={() => void requestCode()}>
          {isSubmitting ? "送信中..." : hasRequestedCode ? "確認コードを再送" : "確認コードを送信"}
        </button>
        <button type="submit" className={styles.primaryButton} disabled={isSubmitting || !hasRequestedCode}>
          {isSubmitting ? "確認中..." : "管理者アクセスを確認"}
        </button>
      </div>
    </form>
  );
}
