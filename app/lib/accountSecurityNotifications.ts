import type { User } from "@supabase/supabase-js";
import { BRAND_NAME, DEFAULT_SITE_URL, SITE_NAME } from "../../src/lib/brand.ts";
import {
  ACTIVE_SUBSCRIPTION_LABELS,
  BUDGET_SENSITIVITY_LABELS,
  DAILY_AVAILABLE_TIME_LABELS,
  DECISION_PRIORITY_LABELS,
  INTEREST_TOPIC_LABELS,
  type UserPreferences
} from "../../src/lib/userPreferences.ts";
import { type UserNotificationPreferences } from "../../src/lib/alerts.ts";
import { sendEmail } from "./email.ts";
import { createServiceRoleClient } from "./supabaseClients.ts";

const APP_BASE_URL = process.env.APP_BASE_URL?.trim() || DEFAULT_SITE_URL;

const JST_FORMATTER = new Intl.DateTimeFormat("ja-JP", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Tokyo"
});

type SecurityNotificationStateRow = {
  last_login_notified_at: string | null;
};

type LoginNotificationParams = {
  user: User;
  request: Request;
};

type AccountChangeNotificationParams = {
  email: string | null | undefined;
  request: Request;
  changeLabel: string;
  changes: string[];
};

type NotificationResult = {
  ok: boolean;
  sent: boolean;
  reason?: string;
  error?: string;
};

const formatUnknownError = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  if (error && typeof error === "object") {
    const message = Reflect.get(error, "message");
    const code = Reflect.get(error, "code");
    if (typeof message === "string" && typeof code === "string") {
      return `${code}: ${message}`;
    }
    if (typeof message === "string") {
      return message;
    }

    try {
      return JSON.stringify(error);
    } catch {
      return "unknown_error";
    }
  }

  return "unknown_error";
};

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const formatTimestamp = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return JST_FORMATTER.format(date);
};

export const extractClientIp = (request: Request): string | null => {
  const direct =
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-real-ip") ??
    request.headers.get("fly-client-ip");

  if (direct?.trim()) {
    return direct.trim();
  }

  const forwarded = request.headers.get("x-forwarded-for");
  if (!forwarded) {
    return null;
  }

  const first = forwarded.split(",")[0]?.trim();
  return first || null;
};

export const extractUserAgent = (request: Request): string | null => {
  const value = request.headers.get("user-agent")?.trim();
  return value || null;
};

export const shouldSendLoginNotification = (
  lastNotifiedAt: string | null | undefined,
  lastSignInAt: string | null | undefined
): boolean => {
  if (!lastSignInAt) {
    return false;
  }

  if (!lastNotifiedAt) {
    return true;
  }

  const lastNotifiedTime = new Date(lastNotifiedAt).getTime();
  const lastSignInTime = new Date(lastSignInAt).getTime();
  if (Number.isNaN(lastNotifiedTime) || Number.isNaN(lastSignInTime)) {
    return true;
  }

  return lastSignInTime > lastNotifiedTime;
};

const renderContextList = (params: {
  changedAt: string;
  ipAddress: string | null;
  userAgent: string | null;
}): string[] => {
  const lines = [`日時: ${formatTimestamp(params.changedAt)}`];

  if (params.ipAddress) {
    lines.push(`IP アドレス: ${params.ipAddress}`);
  }

  if (params.userAgent) {
    lines.push(`利用端末: ${params.userAgent}`);
  }

  return lines;
};

const buildEmailHtml = (params: {
  eyebrow: string;
  title: string;
  lead: string;
  items: string[];
}): string => {
  const itemMarkup = params.items
    .map((item) => `<li style="margin:0 0 8px;">${escapeHtml(item)}</li>`)
    .join("");

  return `<!DOCTYPE html>
<html lang="ja">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:24px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden;">
  <tr><td style="background:#0f172a;padding:20px 24px;">
    <span style="color:#f8fafc;font-size:16px;font-weight:800;letter-spacing:0.02em;">${escapeHtml(SITE_NAME)}</span>
  </td></tr>
  <tr><td style="padding:28px 24px;">
    <p style="margin:0 0 6px;font-size:12px;font-weight:700;color:#0369a1;text-transform:uppercase;letter-spacing:0.1em;">${escapeHtml(params.eyebrow)}</p>
    <h1 style="margin:0 0 12px;font-size:20px;color:#0f172a;line-height:1.4;">${escapeHtml(params.title)}</h1>
    <p style="margin:0 0 20px;font-size:15px;color:#475569;line-height:1.7;">${escapeHtml(params.lead)}</p>
    <ul style="margin:0;padding-left:20px;font-size:14px;color:#1e293b;line-height:1.7;">${itemMarkup}</ul>
    <p style="margin:20px 0 0;font-size:14px;line-height:1.7;">
      <a href="${APP_BASE_URL}/account" style="color:#0369a1;text-decoration:none;font-weight:700;">アカウントページを開く</a>
    </p>
  </td></tr>
  <tr><td style="padding:16px 24px;border-top:1px solid #e2e8f0;background:#f8fafc;">
    <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.6;">
      このメールは ${escapeHtml(BRAND_NAME)} のセキュリティ通知です。<br>
      身に覚えがない場合は、管理者またはサポートに連絡し、必要に応じてサブスクリプション状態や通知設定を確認してください。
    </p>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
};

const buildEmailText = (params: { title: string; lead: string; items: string[] }): string => {
  return [
    params.title,
    "",
    params.lead,
    "",
    ...params.items.map((item) => `- ${item}`),
    "",
    `アカウントページ: ${APP_BASE_URL}/account`
  ].join("\n");
};

const loadNotificationState = async (userId: string): Promise<SecurityNotificationStateRow | null> => {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("account_security_notification_state")
    .select("last_login_notified_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data as SecurityNotificationStateRow | null) ?? null;
};

const saveLoginNotificationState = async (userId: string, lastLoginNotifiedAt: string): Promise<void> => {
  const supabase = createServiceRoleClient();
  const { error } = await supabase.from("account_security_notification_state").upsert(
    {
      user_id: userId,
      last_login_notified_at: lastLoginNotifiedAt
    },
    { onConflict: "user_id" }
  );

  if (error) {
    throw error;
  }
};

const sendLoginNotificationEmail = async (params: {
  to: string;
  signedInAt: string;
  ipAddress: string | null;
  userAgent: string | null;
}) => {
  const title = "ログインを確認しました";
  const lead = "判断のじかん by SignalMove へのログインを検知しました。";
  const items = renderContextList({
    changedAt: params.signedInAt,
    ipAddress: params.ipAddress,
    userAgent: params.userAgent
  });

  return sendEmail({
    to: params.to,
    subject: `【${BRAND_NAME}】ログインを確認しました`,
    html: buildEmailHtml({
      eyebrow: "SECURITY",
      title,
      lead,
      items
    }),
    text: buildEmailText({ title, lead, items })
  });
};

const sendAccountChangeNotificationEmail = async (params: {
  to: string;
  changeLabel: string;
  changes: string[];
  changedAt: string;
  ipAddress: string | null;
  userAgent: string | null;
}) => {
  const title = "アカウント設定が更新されました";
  const lead = `${params.changeLabel} に変更がありました。`;
  const items = [
    ...params.changes,
    ...renderContextList({
      changedAt: params.changedAt,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent
    })
  ];

  return sendEmail({
    to: params.to,
    subject: `【${BRAND_NAME}】アカウント設定が更新されました`,
    html: buildEmailHtml({
      eyebrow: "ACCOUNT UPDATE",
      title,
      lead,
      items
    }),
    text: buildEmailText({ title, lead, items })
  });
};

const formatPreferenceList = <T extends string>(values: T[], labels: Record<T, string>): string => {
  return values.map((value) => labels[value]).join(", ");
};

const formatPreferenceValue = <T extends string>(
  value: T | null | undefined,
  labels: Record<T, string>,
  fallback = "未設定"
): string => {
  if (!value) {
    return fallback;
  }
  return labels[value];
};

export const describeUserPreferencesChanges = (
  before: UserPreferences | null | undefined,
  after: UserPreferences
): string[] => {
  const changes: string[] = [];

  const beforeTopics = before?.interestTopics ?? [];
  if (JSON.stringify(beforeTopics) !== JSON.stringify(after.interestTopics)) {
    changes.push(
      `興味ジャンル: ${beforeTopics.length ? formatPreferenceList(beforeTopics, INTEREST_TOPIC_LABELS) : "未設定"} → ${formatPreferenceList(after.interestTopics, INTEREST_TOPIC_LABELS)}`
    );
  }

  const beforeSubscriptions = before?.activeSubscriptions ?? [];
  if (JSON.stringify(beforeSubscriptions) !== JSON.stringify(after.activeSubscriptions)) {
    changes.push(
      `利用サービス: ${beforeSubscriptions.length ? formatPreferenceList(beforeSubscriptions, ACTIVE_SUBSCRIPTION_LABELS) : "未設定"} → ${formatPreferenceList(after.activeSubscriptions, ACTIVE_SUBSCRIPTION_LABELS)}`
    );
  }

  if ((before?.decisionPriority ?? null) !== after.decisionPriority) {
    changes.push(
      `重視すること: ${formatPreferenceValue(before?.decisionPriority ?? null, DECISION_PRIORITY_LABELS)} → ${formatPreferenceValue(after.decisionPriority, DECISION_PRIORITY_LABELS)}`
    );
  }

  if ((before?.dailyAvailableTime ?? null) !== after.dailyAvailableTime) {
    changes.push(
      `使える時間: ${formatPreferenceValue(before?.dailyAvailableTime ?? null, DAILY_AVAILABLE_TIME_LABELS)} → ${formatPreferenceValue(after.dailyAvailableTime, DAILY_AVAILABLE_TIME_LABELS)}`
    );
  }

  if ((before?.budgetSensitivity ?? null) !== after.budgetSensitivity) {
    changes.push(
      `予算感度: ${formatPreferenceValue(before?.budgetSensitivity ?? null, BUDGET_SENSITIVITY_LABELS)} → ${formatPreferenceValue(after.budgetSensitivity, BUDGET_SENSITIVITY_LABELS)}`
    );
  }

  return changes;
};

export const describeNotificationPreferenceChanges = (
  before: UserNotificationPreferences,
  after: UserNotificationPreferences
): string[] => {
  const changes: string[] = [];

  if (before.weeklyDigestEnabled !== after.weeklyDigestEnabled) {
    changes.push(`週ごとのまとめ: ${before.weeklyDigestEnabled ? "有効" : "無効"} → ${after.weeklyDigestEnabled ? "有効" : "無効"}`);
  }

  if (before.deadlineAlertEnabled !== after.deadlineAlertEnabled) {
    changes.push(`期限と保存中のお知らせ: ${before.deadlineAlertEnabled ? "有効" : "無効"} → ${after.deadlineAlertEnabled ? "有効" : "無効"}`);
  }

  if (before.outcomeReminderEnabled !== after.outcomeReminderEnabled) {
    changes.push(`結果の記録リマインド: ${before.outcomeReminderEnabled ? "有効" : "無効"} → ${after.outcomeReminderEnabled ? "有効" : "無効"}`);
  }

  return changes;
};

export const notifyLoginIfNeeded = async (params: LoginNotificationParams): Promise<NotificationResult> => {
  const email = params.user.email?.trim();
  const lastSignInAt = params.user.last_sign_in_at ?? null;

  if (!email || !lastSignInAt) {
    return { ok: true, sent: false, reason: "missing_email_or_last_sign_in_at" };
  }

  let state: SecurityNotificationStateRow | null = null;
  try {
    state = await loadNotificationState(params.user.id);
  } catch (error) {
    console.error("login_notification_state_load_error", {
      error: formatUnknownError(error),
      userId: params.user.id
    });
  }

  if (!shouldSendLoginNotification(state?.last_login_notified_at ?? null, lastSignInAt)) {
    return { ok: true, sent: false, reason: "already_notified" };
  }

  const result = await sendLoginNotificationEmail({
    to: email,
    signedInAt: lastSignInAt,
    ipAddress: extractClientIp(params.request),
    userAgent: extractUserAgent(params.request)
  });

  if (!result.ok) {
    return { ok: false, sent: false, error: result.error };
  }

  try {
    await saveLoginNotificationState(params.user.id, lastSignInAt);
  } catch (error) {
    console.error("login_notification_state_save_error", {
      error: formatUnknownError(error),
      userId: params.user.id
    });
    return { ok: true, sent: true, reason: "state_persist_failed" };
  }

  return { ok: true, sent: true };
};

export const notifyAccountChange = async (
  params: AccountChangeNotificationParams
): Promise<NotificationResult> => {
  const email = params.email?.trim();
  if (!email) {
    return { ok: true, sent: false, reason: "missing_email" };
  }

  if (params.changes.length === 0) {
    return { ok: true, sent: false, reason: "no_changes" };
  }

  const result = await sendAccountChangeNotificationEmail({
    to: email,
    changeLabel: params.changeLabel,
    changes: params.changes,
    changedAt: new Date().toISOString(),
    ipAddress: extractClientIp(params.request),
    userAgent: extractUserAgent(params.request)
  });

  if (!result.ok) {
    return { ok: false, sent: false, error: result.error };
  }

  return { ok: true, sent: true };
};
