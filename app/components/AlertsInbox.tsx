"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { track } from "@/src/lib/analytics";
import { ALERT_URGENCY_LABELS, type AlertType } from "@/src/lib/alerts";
import AnalyticsEventOnRender from "./AnalyticsEventOnRender";
import styles from "./alerts-inbox.module.css";
import type { StoredUserAlert } from "@/app/lib/alerts";

type AlertsInboxProps = {
  alerts: StoredUserAlert[];
  page: string;
  title?: string;
  lead?: string;
  emptyTitle?: string;
  emptyCopy?: string;
  showViewAllLink?: boolean;
};

const formatDueAt = (value: string | null): string => {
  if (!value) return "期限未設定";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("ja-JP", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
};

const resolveClickEvents = (alertType: AlertType): ("alert_click" | "weekly_digest_alert_click" | "outcome_reminder_alert_click")[] => {
  if (alertType === "weekly_digest_ready") {
    return ["alert_click", "weekly_digest_alert_click"];
  }

  if (alertType === "outcome_reminder") {
    return ["alert_click", "outcome_reminder_alert_click"];
  }

  return ["alert_click"];
};

export default function AlertsInbox({
  alerts,
  page,
  title = "通知",
  lead = "期限が近いものや見直したい判断を、ここからまとめて開き直せます。",
  emptyTitle = "今はお知らせがありません",
  emptyCopy = "見直しタイミングが来た判断や週次まとめがあると、ここに表示されます。",
  showViewAllLink = false
}: AlertsInboxProps) {
  const router = useRouter();
  const [items, setItems] = useState(alerts);
  const [pendingAlertId, setPendingAlertId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setItems(alerts);
  }, [alerts]);

  const unreadCount = useMemo(() => items.filter((item) => !item.isRead).length, [items]);

  const updateAlert = async (alertId: string, action: "read" | "dismiss") => {
    setPendingAlertId(alertId);

    try {
      const response = await fetch(`/api/alerts/${alertId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ action })
      });

      if (!response.ok) {
        return;
      }

      const payload = (await response.json().catch(() => null)) as
        | { ok: true; alert: StoredUserAlert | null }
        | { ok: false; error: string }
        | null;

      if (!payload || !payload.ok) {
        return;
      }

      setItems((current) => {
        if (action === "dismiss") {
          return current.filter((item) => item.id !== alertId);
        }

        return current.map((item) => (item.id === alertId && payload.alert ? payload.alert : item));
      });
      startTransition(() => {
        router.refresh();
      });
    } finally {
      setPendingAlertId(null);
    }
  };

  return (
    <section className={styles.panel}>
      <div className={styles.panelHeader}>
        <div>
          <p className={styles.eyebrow}>お知らせ</p>
          <h2>{title}</h2>
          <p className={styles.lead}>{lead}</p>
        </div>

        <div className={styles.headerActions}>
          <span className={styles.countBadge}>未読 {unreadCount}</span>
          {showViewAllLink ? (
            <Link href="/alerts" className={styles.viewAllLink}>
              すべて見る
            </Link>
          ) : null}
        </div>
      </div>

      {items.length === 0 ? (
        <div className={styles.emptyState}>
          <h3>{emptyTitle}</h3>
          <p className={styles.emptyCopy}>{emptyCopy}</p>
        </div>
      ) : (
        <div className={styles.list}>
          {items.map((alert) => (
            <article
              key={alert.id}
              className={`${styles.item} ${!alert.isRead ? styles.itemUnread : ""}`.trim()}
            >
              <AnalyticsEventOnRender
                eventName="alert_impression"
                properties={{
                  page,
                  source: "alerts_inbox",
                  alert_id: alert.id,
                  alert_type: alert.alertType,
                  source_kind: alert.sourceKind,
                  source_id: alert.sourceId,
                  urgency: alert.urgency,
                  is_read: alert.isRead
                }}
              />

              <div className={styles.itemTop}>
                <div>
                  <div className={styles.badgeRow}>
                    <span className={`${styles.badge} ${styles.typeBadge}`}>{alert.alertTypeLabel}</span>
                    <span className={`${styles.badge} ${styles[`urgency_${alert.urgency}`]}`.trim()}>
                      {ALERT_URGENCY_LABELS[alert.urgency]}
                    </span>
                    {!alert.isRead ? <span className={styles.metaPill}>未読</span> : null}
                    {alert.previewLimited ? <span className={styles.metaPill}>一部表示</span> : null}
                  </div>
                  <h3>{alert.title}</h3>
                </div>

                <div className={styles.metaRow}>
                  <span className={styles.metaPill}>見直し: {formatDueAt(alert.dueAt)}</span>
                </div>
              </div>

              <p className={styles.summary}>{alert.summary}</p>

              <div className={styles.linkRow}>
                {alert.links.map((link, index) => (
                  <Link
                    key={`${alert.id}-${link.href}-${index}`}
                    href={link.href}
                    className={index === 0 ? styles.primaryLink : styles.secondaryLink}
                    onClick={() => {
                      for (const eventName of resolveClickEvents(alert.alertType)) {
                        track(eventName, {
                          page,
                          source: "alerts_inbox_link",
                          alert_id: alert.id,
                          alert_type: alert.alertType,
                          source_kind: alert.sourceKind,
                          source_id: alert.sourceId,
                          href: link.href,
                          label: link.label,
                          urgency: alert.urgency
                        });
                      }

                      if (!alert.isRead) {
                        void updateAlert(alert.id, "read");
                      }
                    }}
                  >
                    {link.label}
                  </Link>
                ))}
              </div>

              <div className={styles.actionRow}>
                {!alert.isRead ? (
                  <button
                    type="button"
                    className={styles.actionButton}
                    disabled={isPending || pendingAlertId === alert.id}
                    onClick={() => {
                      track("alert_mark_read", {
                        page,
                        source: "alerts_inbox_action",
                        alert_id: alert.id,
                        alert_type: alert.alertType,
                        source_id: alert.sourceId
                      });
                      void updateAlert(alert.id, "read");
                    }}
                  >
                    既読
                  </button>
                ) : null}

                <button
                  type="button"
                  className={styles.actionButton}
                  disabled={isPending || pendingAlertId === alert.id}
                  onClick={() => {
                    track("alert_dismiss", {
                      page,
                      source: "alerts_inbox_action",
                      alert_id: alert.id,
                      alert_type: alert.alertType,
                      source_id: alert.sourceId
                    });
                    void updateAlert(alert.id, "dismiss");
                  }}
                >
                  非表示
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
