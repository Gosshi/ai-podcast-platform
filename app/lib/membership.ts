export const formatMembershipDate = (
  value: string | null,
  locale = "ja-JP",
  options?: Intl.DateTimeFormatOptions
): string => {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString(locale, options);
};

export const resolvePlanName = (planType: string | null, isPaid: boolean): string => {
  if (!planType) {
    return isPaid ? "有料会員" : "無料版";
  }

  if (planType === "pro_monthly") {
    return "月額プラン";
  }

  return planType
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

export const resolveMembershipBadgeLabel = (isPaid: boolean): string => {
  return isPaid ? "有料版" : "無料版";
};

export const resolveMembershipStatusLabel = (
  status: string | null,
  cancelAtPeriodEnd: boolean
): string => {
  if (!status) return "無料プラン";

  if (cancelAtPeriodEnd && (status === "active" || status === "trialing")) {
    return "期間終了で解約予定";
  }

  switch (status) {
    case "trialing":
      return "トライアル中";
    case "active":
      return "利用中";
    case "past_due":
      return "支払い更新待ち";
    case "canceled":
      return "解約済み";
    case "incomplete":
      return "決済処理中";
    case "incomplete_expired":
      return "決済期限切れ";
    case "unpaid":
      return "未払い";
    case "paused":
      return "一時停止";
    case "inactive":
      return "開始前";
    default:
      return status;
  }
};

export const resolvePaymentStateLabel = (status: string | null): string => {
  if (!status) return "未登録";

  switch (status) {
    case "trialing":
    case "active":
      return "正常";
    case "past_due":
      return "更新が必要";
    case "incomplete":
      return "初回決済待ち";
    case "incomplete_expired":
    case "unpaid":
      return "未完了";
    case "paused":
      return "停止中";
    case "canceled":
      return "解約済み";
    case "inactive":
      return "未開始";
    default:
      return status;
  }
};
