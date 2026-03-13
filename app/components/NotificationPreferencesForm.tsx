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
          <h3>Weekly Digest</h3>
          <p>週次まとめ alert を `/alerts` と `/account` に表示します。</p>
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
          <h3>Deadline / Watchlist Alerts</h3>
          <p>期限が近い judgment と watchlist を in-app alert に出します。</p>
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
          <h3>Outcome Reminders</h3>
          <p>outcome 未入力の decision を `/history` と `/alerts` から再訪できるようにします。</p>
        </div>
      </label>

      <div className={styles.actions}>
        <button type="button" className={styles.submitButton} disabled={isPending} onClick={() => void save()}>
          Save
        </button>
        {status ? <p className={styles.status}>{status}</p> : null}
      </div>
    </div>
  );
}
