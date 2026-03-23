import { BRAND_NAME, DEFAULT_SITE_URL, PRODUCT_NAME, SITE_NAME } from "./brand.ts";
import { resolveSubscriptionPaymentTimingText } from "./subscriptionPlan.ts";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL?.trim() || DEFAULT_SITE_URL;
const DEFAULT_CONTACT_EMAIL = "hello@signal-move.com";

const cleanValue = (value: string | undefined): string | null => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

const normalizePhoneDisclosureMode = (
  value: string | undefined
): "public" | "request" => {
  return value?.trim().toLowerCase() === "request" ? "request" : "public";
};

export const LEGAL_PHONE_DISCLOSURE_MODE = normalizePhoneDisclosureMode(
  process.env.LEGAL_PHONE_DISCLOSURE_MODE
);

export const LEGAL_INFO = {
  siteUrl: SITE_URL,
  siteName: SITE_NAME,
  productName: PRODUCT_NAME,
  businessName: cleanValue(process.env.LEGAL_BUSINESS_NAME) ?? BRAND_NAME,
  representativeName: cleanValue(process.env.LEGAL_REPRESENTATIVE_NAME),
  address: cleanValue(process.env.LEGAL_ADDRESS),
  phoneNumber: cleanValue(process.env.LEGAL_PHONE_NUMBER),
  phoneDisclosureMode: LEGAL_PHONE_DISCLOSURE_MODE,
  contactEmail: cleanValue(process.env.LEGAL_CONTACT_EMAIL) ?? DEFAULT_CONTACT_EMAIL,
  contactHours:
    cleanValue(process.env.LEGAL_CONTACT_HOURS) ??
    "お問い合わせはメールにて受け付けます。3営業日以内を目安に返信します。",
  sellingPrice: "有料版 月額780円（税込）",
  additionalFees: "インターネット接続料金、通信料金等はお客様のご負担となります。",
  paymentMethods: "クレジットカード決済（Stripe Checkout を利用）",
  paymentTiming: resolveSubscriptionPaymentTimingText(),
  serviceTiming: "決済完了後、直ちに有料機能をご利用いただけます。",
  cancellation:
    "次回更新日前までにアカウント画面または Stripe Billing Portal からいつでも解約できます。解約後は次回更新日以降の自動課金を停止します。",
  refundPolicy:
    "デジタルコンテンツの性質上、法令上必要な場合を除き、決済完了後の返金はお受けしていません。",
  operatingEnvironment:
    "最新版の主要ブラウザとインターネット接続環境が必要です。通信品質や端末性能により再生体験が変わる場合があります。"
} as const;

export const COMMERCIAL_DISCLOSURE_REQUIRED_FIELDS = [
  {
    key: "representativeName",
    label: "運営責任者名"
  },
  {
    key: "address",
    label: "所在地"
  }
] as const;

export const getMissingCommercialDisclosureFields = (): string[] => {
  return COMMERCIAL_DISCLOSURE_REQUIRED_FIELDS.filter(({ key }) => !LEGAL_INFO[key]).map(
    ({ label }) => label
  );
};

export const shouldDisclosePhoneOnRequest = (): boolean => {
  return LEGAL_PHONE_DISCLOSURE_MODE === "request";
};

export const getPublicContactEmailText = (): string => {
  return LEGAL_INFO.contactEmail.replaceAll("@", " at ");
};

export const getCommercialDisclosurePhoneText = (): string => {
  if (!shouldDisclosePhoneOnRequest()) {
    return LEGAL_INFO.phoneNumber ?? "環境変数 `LEGAL_PHONE_NUMBER` の設定が必要です。";
  }

  return [
    "電話番号はご請求をいただければ、遅滞なく電子メールにて開示します。",
    `開示請求先: ${getPublicContactEmailText()}`
  ].join(" ");
};
