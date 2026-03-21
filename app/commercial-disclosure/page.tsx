import type { Metadata } from "next";
import styles from "@/app/legal/legal-page.module.css";
import { getMissingCommercialDisclosureFields, LEGAL_INFO } from "@/src/lib/legal";

export const metadata: Metadata = {
  title: "特定商取引法に基づく表記",
  description: "判断のじかん by SignalMove の特定商取引法に基づく表記です。"
};

const disclosureRows = [
  {
    term: "販売事業者",
    description: LEGAL_INFO.businessName
  },
  {
    term: "運営責任者",
    description: LEGAL_INFO.representativeName ?? "環境変数 `LEGAL_REPRESENTATIVE_NAME` の設定が必要です。"
  },
  {
    term: "所在地",
    description: LEGAL_INFO.address ?? "環境変数 `LEGAL_ADDRESS` の設定が必要です。"
  },
  {
    term: "電話番号",
    description: LEGAL_INFO.phoneNumber ?? "環境変数 `LEGAL_PHONE_NUMBER` の設定が必要です。"
  },
  {
    term: "お問い合わせ先",
    description: LEGAL_INFO.contactEmail
  },
  {
    term: "受付時間",
    description: LEGAL_INFO.contactHours
  },
  {
    term: "販売価格",
    description: LEGAL_INFO.sellingPrice
  },
  {
    term: "商品代金以外の必要料金",
    description: LEGAL_INFO.additionalFees
  },
  {
    term: "支払方法",
    description: LEGAL_INFO.paymentMethods
  },
  {
    term: "支払時期",
    description: LEGAL_INFO.paymentTiming
  },
  {
    term: "提供時期",
    description: LEGAL_INFO.serviceTiming
  },
  {
    term: "解約について",
    description: LEGAL_INFO.cancellation
  },
  {
    term: "返品・返金",
    description: LEGAL_INFO.refundPolicy
  },
  {
    term: "動作環境",
    description: LEGAL_INFO.operatingEnvironment
  }
] as const;

export default function CommercialDisclosurePage() {
  const missingFields = getMissingCommercialDisclosureFields();

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <section className={styles.hero}>
          <p className={styles.eyebrow}>Legal</p>
          <h1>特定商取引法に基づく表記</h1>
          <p className={styles.lead}>
            「判断のじかん by SignalMove」の有料サービス提供にあたり、特定商取引法に基づく表示事項を掲載します。
          </p>
          {missingFields.length > 0 ? (
            <div className={styles.warning}>
              公開前に {missingFields.join(" / ")} を本番環境変数へ設定してください。
            </div>
          ) : null}
        </section>

        <section className={styles.card}>
          <dl className={styles.definitionList}>
            {disclosureRows.map((row) => (
              <div key={row.term} className={styles.definitionRow}>
                <dt>{row.term}</dt>
                <dd>{row.description}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    </main>
  );
}
