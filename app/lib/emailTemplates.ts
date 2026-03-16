import type { StoredUserAlert } from "./alerts";

const APP_BASE_URL = process.env.APP_BASE_URL?.trim() || "http://127.0.0.1:3000";

const ALERT_SUBJECT_MAP: Record<string, string> = {
  deadline_due_soon: "判断の期限が近づいています",
  watchlist_due_soon: "保存した判断の期限が近づいています",
  outcome_reminder: "判断の結果を記録しませんか？",
  weekly_digest_ready: "今週の判断まとめ"
};

type EmailContent = {
  subject: string;
  html: string;
  text: string;
};

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const resolveCTAUrl = (alert: StoredUserAlert): string => {
  const firstLink = alert.links[0];
  if (firstLink?.href) {
    return `${APP_BASE_URL}${firstLink.href}`;
  }
  return `${APP_BASE_URL}/decisions`;
};

const resolveCTALabel = (alert: StoredUserAlert): string => {
  const firstLink = alert.links[0];
  return firstLink?.label ?? "アプリで確認する";
};

const buildHtmlTemplate = (alert: StoredUserAlert, ctaUrl: string, ctaLabel: string): string => {
  return `<!DOCTYPE html>
<html lang="ja">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:24px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden;">
  <tr><td style="background:#0f172a;padding:20px 24px;">
    <span style="color:#f8fafc;font-size:16px;font-weight:800;letter-spacing:0.02em;">AI Podcast</span>
  </td></tr>
  <tr><td style="padding:28px 24px;">
    <p style="margin:0 0 6px;font-size:12px;font-weight:700;color:#0369a1;text-transform:uppercase;letter-spacing:0.1em;">${escapeHtml(alert.alertTypeLabel)}</p>
    <h1 style="margin:0 0 12px;font-size:20px;color:#0f172a;line-height:1.4;">${escapeHtml(alert.title)}</h1>
    <p style="margin:0 0 20px;font-size:15px;color:#475569;line-height:1.7;">${escapeHtml(alert.summary)}</p>
    <a href="${ctaUrl}" style="display:inline-block;padding:12px 24px;background:#0f172a;color:#f8fafc;font-size:14px;font-weight:700;text-decoration:none;border-radius:999px;">${escapeHtml(ctaLabel)}</a>
  </td></tr>
  <tr><td style="padding:16px 24px;border-top:1px solid #e2e8f0;background:#f8fafc;">
    <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.6;">
      このメールは AI Podcast から送信されています。<br>
      <a href="${APP_BASE_URL}/account" style="color:#64748b;">通知設定を変更する</a>
    </p>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
};

const buildPlainText = (alert: StoredUserAlert, ctaUrl: string): string => {
  return [
    `[${alert.alertTypeLabel}]`,
    "",
    alert.title,
    "",
    alert.summary,
    "",
    `確認する: ${ctaUrl}`,
    "",
    "---",
    "AI Podcast",
    `通知設定: ${APP_BASE_URL}/account`
  ].join("\n");
};

export const buildAlertEmail = (alert: StoredUserAlert): EmailContent => {
  const subject = ALERT_SUBJECT_MAP[alert.alertType] ?? alert.title;
  const ctaUrl = resolveCTAUrl(alert);
  const ctaLabel = resolveCTALabel(alert);

  return {
    subject,
    html: buildHtmlTemplate(alert, ctaUrl, ctaLabel),
    text: buildPlainText(alert, ctaUrl)
  };
};
