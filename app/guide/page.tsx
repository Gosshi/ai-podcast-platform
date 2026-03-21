import type { Metadata } from "next";
import Link from "next/link";
import TrackedLink from "@/app/components/TrackedLink";
import { MONTHLY_PRICE_YEN, resolveSubscriptionTrialLabel } from "@/src/lib/subscriptionPlan";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "使い方ガイド",
  description:
    "判断のじかんの使い方を3分で理解。AIポッドキャストを聴き、判断カードと振り返りで次の一手を決める流れを解説します。"
};

export default function GuidePage() {
  const trialLabel = resolveSubscriptionTrialLabel();

  return (
    <main className={styles.page}>
      <Link href="/decisions" className={styles.backLink}>
        ← 今日のエピソードに戻る
      </Link>

      <h1 className={styles.pageTitle}>判断のじかんの使い方</h1>
      <p className={styles.pageLead}>
        毎日 AI がエピソードを作り、
        あなたの「やる・様子見・見送り」を判断しやすくします。
      </p>

      {/* --- Step 1: Listen --- */}
      <section className={styles.section}>
        <h2>
          <span className={`${styles.sectionIcon} ${styles.iconListen}`}>1</span>
          ポッドキャストを聴く
        </h2>
        <div className={styles.sectionBody}>
          <p>
            テック・サブスク・買い物・情報収集など、日々迷いやすいテーマを
            AI がエピソード化。通勤中やスキマ時間に聴くだけで、
            今日考えるべき論点がわかります。
          </p>
          <p>
            エピソードは短時間で聴き切れる長さを基本に、
            読む前に「何をやるか」「何を見送るか」を決めやすくする構成です。
          </p>
        </div>
      </section>

      {/* --- Step 2: Cards --- */}
      <section className={styles.section}>
        <h2>
          <span className={`${styles.sectionIcon} ${styles.iconCards}`}>2</span>
          トピックカードで判断する
        </h2>
        <div className={styles.sectionBody}>
          <p>
            各トピックには AI が「おすすめの判断」をつけています。
            迷いをそのまま残さず、カードで結論を見やすく整理します。
          </p>

          <div className={styles.judgmentGrid}>
            <div className={`${styles.judgmentItem} ${styles.judgmentUseNow}`}>
              <strong>今すぐ</strong>
              <p>今やるべき。行動して損なし</p>
            </div>
            <div className={`${styles.judgmentItem} ${styles.judgmentWatch}`}>
              <strong>様子見</strong>
              <p>もう少し情報を待ってから</p>
            </div>
            <div className={`${styles.judgmentItem} ${styles.judgmentSkip}`}>
              <strong>見送り</strong>
              <p>今は不要。スルーでOK</p>
            </div>
          </div>

          <p style={{ marginTop: "0.75rem" }}>
            カードを開くと、判断の根拠や具体的な行動提案を確認できます。
          </p>
        </div>
      </section>

      {/* --- Step 3: Consult --- */}
      <section className={styles.section}>
        <h2>
          <span className={`${styles.sectionIcon} ${styles.iconConsult}`}>3</span>
          AI に相談する
        </h2>
        <div className={styles.sectionBody}>
          <p>
            「このサブスク続けるべき？」「新しいツール試すべき？」など、
            自分の悩みを入力すると、AI があなたのプロフィールに合わせた
            判断カードを生成します。
          </p>

          <ol className={styles.stepList}>
            <li className={styles.stepItem}>
              <div className={styles.stepContent}>
                <strong>悩みを入力</strong>
                <p>5〜500 文字で、迷っていることを書く</p>
              </div>
            </li>
            <li className={styles.stepItem}>
              <div className={styles.stepContent}>
                <strong>AI が判断カードを生成</strong>
                <p>予算・優先度・興味をもとにパーソナライズ</p>
              </div>
            </li>
            <li className={styles.stepItem}>
              <div className={styles.stepContent}>
                <strong>行動 or 様子見を決める</strong>
                <p>具体的な次のアクションと見直しタイミングを提案</p>
              </div>
            </li>
          </ol>
        </div>
      </section>

      {/* --- Plans --- */}
      <section className={styles.section}>
        <h2>
          <span className={`${styles.sectionIcon} ${styles.iconPlan}`}>4</span>
          無料版と有料版のちがい
        </h2>
        <div className={styles.sectionBody}>
          <table className={styles.comparisonTable}>
            <thead>
              <tr>
                <th>機能</th>
                <th>無料版</th>
                <th>有料版（¥{MONTHLY_PRICE_YEN}/月）</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>ポッドキャスト再生</td>
                <td className={styles.checkMark}>&#10003;</td>
                <td className={styles.checkMark}>&#10003;</td>
              </tr>
              <tr>
                <td>トピックカード概要</td>
                <td className={styles.checkMark}>&#10003;</td>
                <td className={styles.checkMark}>&#10003;</td>
              </tr>
              <tr>
                <td>行動提案・見直しタイミング</td>
                <td>-</td>
                <td className={styles.checkMark}>&#10003;</td>
              </tr>
              <tr>
                <td>フルスクリプト</td>
                <td>-</td>
                <td className={styles.checkMark}>&#10003;</td>
              </tr>
              <tr>
                <td>過去アーカイブ</td>
                <td>直近 1 週間</td>
                <td>無制限</td>
              </tr>
              <tr>
                <td>振り返りとお知らせ</td>
                <td>一部のみ</td>
                <td className={styles.checkMark}>&#10003;</td>
              </tr>
              <tr>
                <td>AI 相談</td>
                <td>3 回/日</td>
                <td>20 回/日</td>
              </tr>
            </tbody>
          </table>
          {trialLabel ? <p style={{ marginTop: "0.75rem" }}>{trialLabel}。有料版のすべての機能を試せます。</p> : null}
        </div>
      </section>

      {/* --- FAQ --- */}
      <section className={styles.section}>
        <h2>よくある質問</h2>
        <dl className={styles.faqList}>
          <div className={styles.faqItem}>
            <dt>エピソードは毎日更新されますか？</dt>
            <dd>
              はい。最新のトレンドニュースをもとに、AI が毎日新しいエピソードを生成します。
            </dd>
          </div>
          <div className={styles.faqItem}>
            <dt>どんなジャンルが対象ですか？</dt>
            <dd>
              テクノロジー・サブスク・日々の買い物や情報収集など、
              時間と支出の判断に関わるテーマを中心に扱います。
            </dd>
          </div>
          <div className={styles.faqItem}>
            <dt>AI の判断は信頼できますか？</dt>
            <dd>
              AI の判断はあくまで参考情報です。最終的な決定はご自身で行ってください。
              判断の根拠や関連ニュースソースも一緒に確認できます。
            </dd>
          </div>
          <div className={styles.faqItem}>
            <dt>有料版はいつでも解約できますか？</dt>
            <dd>
              はい。アカウント設定からいつでも解約でき、
              現在の請求期間が終わるまでは引き続き利用できます。
            </dd>
          </div>
        </dl>
      </section>

      {/* --- CTA --- */}
      <section className={styles.ctaSection}>
        <h2>さっそく聴いてみよう</h2>
        <p>今日のエピソードが待っています。</p>
        <TrackedLink
          href="/decisions"
          className={styles.ctaButton}
          eventName="nav_click"
          eventProperties={{
            page: "/guide",
            source: "guide_bottom_cta",
            destination: "/decisions"
          }}
        >
          今日のエピソードへ
        </TrackedLink>
      </section>
    </main>
  );
}
