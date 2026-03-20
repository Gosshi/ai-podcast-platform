"use client";

import { useState, useTransition, type FormEvent } from "react";
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
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setMessage(null);

    const response = await fetch("/api/admin/access", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        passcode,
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
      } else if (payload.error === "invalid_passcode") {
        const attempts = typeof payload.remainingAttempts === "number" ? payload.remainingAttempts : null;
        setError(
          attempts !== null
            ? `管理者パスコードが違います。残り ${attempts} 回です。`
            : "管理者パスコードが違います。"
        );
      } else {
        setError("管理者アクセスを確認できませんでした。");
      }
      return;
    }

    setMessage("管理者アクセスを確認しました。");
    startTransition(() => {
      router.push(payload.next!);
      router.refresh();
    });
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <label className={styles.field}>
        <span>管理者パスコード</span>
        <input
          type="password"
          autoComplete="current-password"
          value={passcode}
          onChange={(event) => setPasscode(event.target.value)}
          placeholder="管理者パスコードを入力"
          required
          disabled={isPending}
        />
      </label>

      {error ? <p className={styles.errorText}>{error}</p> : null}
      {message ? <p className={styles.successText}>{message}</p> : null}

      <button type="submit" className={styles.primaryButton} disabled={isPending}>
        {isPending ? "確認中..." : "管理者アクセスを確認"}
      </button>
    </form>
  );
}
