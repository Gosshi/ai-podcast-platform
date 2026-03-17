"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { UserNotificationPreferences } from "@/src/lib/alerts";
import styles from "./notification-preferences-form.module.css";

type NotificationPreferencesFormProps = {
  preferences: UserNotificationPreferences;
};

export default function NotificationPreferencesForm({
  preferences
}: NotificationPreferencesFormProps) {
  const router = useRouter();
  const [formState, setFormState] = useState(preferences);
  const [status, setStatus] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setFormState(preferences);
  }, [preferences]);

  const save = async () => {
    setStatus(null);

    const response = await fetch("/api/alerts/preferences", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(formState)
    });

    if (!response.ok) {
      setStatus("保存に失敗しました。");
      return;
    }

    setStatus("保存しました。");
    startTransition(() => {
      router.refresh();
    });
  };

  return (
    <div className={styles.form}>
      <label className={styles.option}>
        <input
          type="checkbox"
          checked={formState.weeklyDigestEnabled}
          onChange={(event) =>
            setFormState((current) => ({
              ...current,
              weeklyDigestEnabled: event.target.checked
            }))
          }
        />
        <div>
          <h3>週ごとのまとめ</h3>
          <p>週次まとめを `/alerts` と `/account` に表示します。</p>
        </div>
      </label>

      <label className={styles.option}>
        <input
          type="checkbox"
          checked={formState.deadlineAlertEnabled}
          onChange={(event) =>
            setFormState((current) => ({
              ...current,
              deadlineAlertEnabled: event.target.checked
            }))
          }
        />
        <div>
          <h3>期限と保存中のお知らせ</h3>
          <p>期限が近いトピックや保存した候補をお知らせに表示します。</p>
        </div>
      </label>

      <label className={styles.option}>
        <input
          type="checkbox"
          checked={formState.outcomeReminderEnabled}
          onChange={(event) =>
            setFormState((current) => ({
              ...current,
              outcomeReminderEnabled: event.target.checked
            }))
          }
        />
        <div>
          <h3>結果の記録リマインド</h3>
          <p>結果未入力のアクションを履歴と通知から見直せるようにします。</p>
        </div>
      </label>

      <div className={styles.actions}>
        <button type="button" className={styles.submitButton} disabled={isPending} onClick={() => void save()}>
          保存する
        </button>
        {status ? <p className={styles.status}>{status}</p> : null}
      </div>
    </div>
  );
}
