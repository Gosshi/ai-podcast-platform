import type { Metadata } from "next";
import styles from "@/app/legal/legal-page.module.css";
import { LEGAL_INFO } from "@/src/lib/legal";

export const metadata: Metadata = {
  title: "プライバシーポリシー",
  description: "判断のじかん by SignalMove のプライバシーポリシーです。"
};

export default function PrivacyPage() {
  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <section className={styles.hero}>
          <p className={styles.eyebrow}>Privacy</p>
          <h1>プライバシーポリシー</h1>
          <p className={styles.lead}>
            {LEGAL_INFO.businessName}（以下「当社」）は、{LEGAL_INFO.siteName}
            における利用者情報の取扱いについて、以下のとおり定めます。
          </p>
          <p className={styles.muted}>最終更新日: 2026-03-21</p>
        </section>

        <section className={styles.card}>
          <h2>1. 取得する情報</h2>
          <ul className={styles.list}>
            <li>メールアドレス、認証状態、会員情報などのアカウント情報</li>
            <li>オンボーディング設定、視聴履歴、判断履歴、保存したトピック、通知設定などの利用情報</li>
            <li>購読状態、Stripe の顧客 ID / subscription ID など決済連携に必要な情報</li>
            <li>ページ閲覧、CTA クリック、再生開始などの分析イベント</li>
            <li>管理者アクセス時のメール確認コード送信記録、試行回数、ロック状態などのセキュリティログ</li>
          </ul>
        </section>

        <section className={styles.card}>
          <h2>2. 利用目的</h2>
          <ul className={styles.list}>
            <li>アカウント認証、会員状態確認、決済処理、本人確認のため</li>
            <li>エピソード配信、パーソナライズ、保存・履歴・通知機能の提供のため</li>
            <li>不正利用防止、障害対応、監査、セキュリティ向上のため</li>
            <li>利用状況の把握、改善、機能検証、サポート対応のため</li>
          </ul>
        </section>

        <section className={styles.card}>
          <h2>3. 第三者提供・外部委託</h2>
          <p>
            当社は、サービス提供に必要な範囲で外部サービスを利用します。主な委託先・連携先は
            Supabase、Stripe、Resend、Vercel、OpenAI です。法令に基づく場合を除き、本人の同意なく
            個人データを第三者へ提供しません。
          </p>
        </section>

        <section className={styles.card}>
          <h2>4. Cookie 等</h2>
          <p>
            本サービスでは、ログイン状態の維持、セキュリティ制御、利用状況の把握のため、Cookie
            その他これに類する技術を使用する場合があります。
          </p>
        </section>

        <section className={styles.card}>
          <h2>5. 保有個人データに関する公表事項</h2>
          <dl className={styles.definitionList}>
            <div className={styles.definitionRow}>
              <dt>事業者の名称</dt>
              <dd>{LEGAL_INFO.businessName}</dd>
            </div>
            <div className={styles.definitionRow}>
              <dt>住所・代表者</dt>
              <dd>
                {LEGAL_INFO.address ?? "本番公開前に `LEGAL_ADDRESS` の設定が必要です。"}
                <br />
                {LEGAL_INFO.representativeName ??
                  "本番公開前に `LEGAL_REPRESENTATIVE_NAME` の設定が必要です。"}
              </dd>
            </div>
            <div className={styles.definitionRow}>
              <dt>利用目的</dt>
              <dd>上記「2. 利用目的」に記載のとおりです。</dd>
            </div>
            <div className={styles.definitionRow}>
              <dt>開示等の請求窓口</dt>
              <dd>{LEGAL_INFO.contactEmail}</dd>
            </div>
            <div className={styles.definitionRow}>
              <dt>苦情・相談窓口</dt>
              <dd>{LEGAL_INFO.contactEmail}</dd>
            </div>
            <div className={styles.definitionRow}>
              <dt>安全管理措置の概要</dt>
              <dd>
                アクセス権限の管理、認証強化、通信の暗号化、環境変数による秘密情報管理、
                ログ監視、外部サービスの権限分離、定期的なセキュリティ確認を実施します。
              </dd>
            </div>
          </dl>
        </section>

        <section className={styles.card}>
          <h2>6. 開示・訂正・削除等</h2>
          <p>
            利用者は、法令に基づき、当社に対して保有個人データの開示、訂正、追加、削除、
            利用停止等を求めることができます。ご希望の際は {LEGAL_INFO.contactEmail} までご連絡ください。
          </p>
        </section>

        <section className={styles.card}>
          <h2>7. 改定</h2>
          <p>
            当社は、法令改正やサービス変更に応じて本ポリシーを改定できます。重要な変更は本サイト上で告知します。
          </p>
        </section>
      </div>
    </main>
  );
}
