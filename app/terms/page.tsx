import type { Metadata } from "next";
import styles from "@/app/legal/legal-page.module.css";
import { LEGAL_INFO } from "@/src/lib/legal";

export const metadata: Metadata = {
  title: "利用規約",
  description: "判断のじかん by SignalMove の利用規約です。"
};

export default function TermsPage() {
  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <section className={styles.hero}>
          <p className={styles.eyebrow}>Legal</p>
          <h1>利用規約</h1>
          <p className={styles.lead}>
            本規約は、{LEGAL_INFO.siteName}（以下「本サービス」）の利用条件を定めるものです。
          </p>
          <p className={styles.muted}>最終更新日: 2026-03-21</p>
        </section>

        <section className={styles.card}>
          <h2>1. 適用</h2>
          <p>
            本規約は、本サービスの閲覧、会員登録、無料プラン、有料プラン、関連するメール通知および
            RSS 配信の利用に適用されます。
          </p>
        </section>

        <section className={styles.card}>
          <h2>2. アカウント</h2>
          <ul className={styles.list}>
            <li>ログインにはメールアドレスを利用した認証を使用します。</li>
            <li>登録情報は正確かつ最新の内容に保ってください。</li>
            <li>認証リンクや確認コードの第三者共有は禁止します。</li>
          </ul>
        </section>

        <section className={styles.card}>
          <h2>3. 有料プラン</h2>
          <ul className={styles.list}>
            <li>有料プランの料金は {LEGAL_INFO.sellingPrice} です。</li>
            <li>決済は Stripe を通じて行い、当社はカード情報を保持しません。</li>
            <li>{LEGAL_INFO.cancellation}</li>
            <li>{LEGAL_INFO.refundPolicy}</li>
          </ul>
        </section>

        <section className={styles.card}>
          <h2>4. 禁止事項</h2>
          <ul className={styles.list}>
            <li>法令、公序良俗、本規約に違反する行為</li>
            <li>本サービスの運営を妨害する行為、不正アクセス、過度な負荷を与える行為</li>
            <li>本サービス上のコンテンツを無断転載、再配布、再販売する行為</li>
            <li>第三者になりすまして利用する行為</li>
          </ul>
        </section>

        <section className={styles.card}>
          <h2>5. 知的財産権</h2>
          <p>
            本サービスに含まれるテキスト、音声、画像、デザイン、ソフトウェアおよびそれらに関する知的財産権は、
            当社または正当な権利者に帰属します。
          </p>
        </section>

        <section className={styles.card}>
          <h2>6. 免責</h2>
          <ul className={styles.list}>
            <li>
              本サービスは情報整理の補助を目的としたものであり、投資、法律、税務、医療その他の専門助言を提供するものではありません。
            </li>
            <li>
              AI 生成内容や外部情報源には誤り、遅延、不完全性が含まれる場合があります。最終判断は利用者自身の責任で行ってください。
            </li>
            <li>
              外部サービス、決済事業者、配信プラットフォーム等に起因する障害について、当社は合理的な範囲でのみ対応します。
            </li>
          </ul>
        </section>

        <section className={styles.card}>
          <h2>7. サービス変更・停止</h2>
          <p>
            当社は、保守、障害対応、法令対応、品質改善その他必要な場合に、本サービスの全部または一部を変更、停止、終了できます。
          </p>
        </section>

        <section className={styles.card}>
          <h2>8. 規約変更</h2>
          <p>
            当社は、必要に応じて本規約を変更できます。重要な変更は本サイト上への掲示その他適切な方法で通知します。
          </p>
        </section>

        <section className={styles.card}>
          <h2>9. 準拠法・管轄</h2>
          <p>
            本規約は日本法に準拠し、本サービスに関して紛争が生じた場合は、東京地方裁判所を第一審の専属的合意管轄裁判所とします。
          </p>
        </section>
      </div>
    </main>
  );
}
