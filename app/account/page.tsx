import Link from "next/link";
import MemberControls from "@/app/components/MemberControls";
import {
  formatMembershipDate,
  resolveMembershipBadgeLabel,
  resolveMembershipStatusLabel,
  resolvePaymentStateLabel,
  resolvePlanName
} from "@/app/lib/membership";
import { getViewerFromCookies } from "@/app/lib/viewer";
import styles from "./page.module.css";

type SearchParams = {
  subscription?: string | string[];
};

const readParam = (value: string | string[] | undefined): string | null => {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
};

export default async function AccountPage({
  searchParams
}: {
  searchParams: Promise<SearchParams>;
}) {
  const viewer = await getViewerFromCookies();
  const params = await searchParams;
  const subscription = readParam(params.subscription);
  const membershipBadge = resolveMembershipBadgeLabel(viewer?.isPaid ?? false);
  const planName = resolvePlanName(viewer?.planType ?? null, viewer?.isPaid ?? false);
  const membershipStatus = resolveMembershipStatusLabel(
    viewer?.subscriptionStatus ?? null,
    viewer?.cancelAtPeriodEnd ?? false
  );
  const paymentState = resolvePaymentStateLabel(viewer?.subscriptionStatus ?? null);
  const currentPeriodEnd = formatMembershipDate(viewer?.currentPeriodEnd ?? null, "ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric"
  });

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>Account</p>
            <h1>プランと請求を、自分で把握して管理できる状態にする。</h1>
            <p className={styles.lead}>
              現在のプラン、購読ステータス、次回更新日、支払い状態を一画面で確認できます。購読中は
              Billing Portal から更新や解約もセルフサービスで進められます。
            </p>
            {subscription === "success" && viewer?.isPaid ? (
              <p className={`${styles.statusMessage} ${styles.success}`}>
                有料会員への切り替えが完了しました。判断カード全文、判断期限、監視ポイント、アーカイブが使えます。
              </p>
            ) : null}
            {subscription === "success" && !viewer?.isPaid ? (
              <p className={`${styles.statusMessage} ${styles.info}`}>
                Checkout は完了しています。Stripe webhook の反映中は数秒かかることがあります。ページを再読み込みすると最新状態を確認できます。
              </p>
            ) : null}
            {subscription === "cancel" ? (
              <p className={`${styles.statusMessage} ${styles.cancel}`}>
                Checkout はキャンセルされました。無料版のまま判断サマリーを確認できます。必要になった時点で再開できます。
              </p>
            ) : null}
          </div>

          <MemberControls
            viewer={viewer}
            title="会員管理"
            copy="購読の開始、支払い方法の更新、解約確認まで、この画面を起点に迷わず進められるように整えています。"
            showBillingPortal
          />
        </section>

        <section className={styles.section}>
          <div>
            <p className={styles.eyebrow}>Membership Snapshot</p>
            <h2>現在の会員状態</h2>
            <p className={styles.sectionLead}>free / paid の違いと、次に何をすればよいかをすぐ判断できる表示に整理しています。</p>
          </div>

          <div className={styles.statsGrid}>
            <article className={styles.statCard}>
              <span className={styles.statLabel}>会員区分</span>
              <strong className={styles.statValue}>{membershipBadge}</strong>
            </article>
            <article className={styles.statCard}>
              <span className={styles.statLabel}>プラン</span>
              <strong className={styles.statValue}>{planName}</strong>
            </article>
            <article className={styles.statCard}>
              <span className={styles.statLabel}>ステータス</span>
              <strong className={styles.statValue}>{membershipStatus}</strong>
            </article>
            <article className={styles.statCard}>
              <span className={styles.statLabel}>支払い状態</span>
              <strong className={styles.statValue}>{paymentState}</strong>
            </article>
          </div>

          <div className={styles.statsGrid}>
            <article className={styles.statCard}>
              <span className={styles.statLabel}>次回更新日</span>
              <strong className={styles.statValue}>{currentPeriodEnd}</strong>
            </article>
            <article className={styles.statCard}>
              <span className={styles.statLabel}>購読管理</span>
              <strong className={styles.statValue}>{viewer?.stripeCustomerId ? "Billing Portal対応" : "ログイン後に表示"}</strong>
            </article>
            <article className={styles.statCard}>
              <span className={styles.statLabel}>判断カード</span>
              <strong className={styles.statValue}>{viewer?.isPaid ? "全文を表示" : "プレビューまで"}</strong>
            </article>
            <article className={styles.statCard}>
              <span className={styles.statLabel}>DeepDive</span>
              <strong className={styles.statValue}>{viewer?.isPaid ? "完全版を表示" : "短い preview を表示"}</strong>
            </article>
          </div>
        </section>

        <section className={styles.section}>
          <div>
            <p className={styles.eyebrow}>After Purchase</p>
            <h2>{viewer?.isPaid ? "有料会員で使えること" : "有料会員になるとできること"}</h2>
            <p className={styles.sectionLead}>
              課金後の価値を「見える化」して、継続利用の理由が伝わるようにしています。
            </p>
          </div>

          <div className={styles.featureGrid}>
            <article className={styles.featureCard}>
              <h3>判断カード全文</h3>
              <p>summary だけでなく、行動指針、期限、監視ポイントまでそのまま確認できます。</p>
            </article>
            <article className={styles.featureCard}>
              <h3>DeepDive 完全版</h3>
              <p>各テーマの深い判断と条件分岐を、プレビュー省略なしで追えます。</p>
            </article>
            <article className={styles.featureCard}>
              <h3>アーカイブと管理</h3>
              <p>過去エピソードをさかのぼりつつ、支払い方法や解約も Billing Portal で自分で管理できます。</p>
            </article>
            <article className={styles.featureCard}>
              <h3>Personal Decision Profile</h3>
              <p>履歴から frame / genre / outcome の傾向を集計し、paid は judgment card に personal hint を返します。</p>
            </article>
          </div>

          <ul className={styles.list}>
            <li>無料版は判断サマリーの入口まで。有料版は「どう動くか」を決める材料まで開放します。</li>
            <li>paid は Decision History を profile 化し、次の判断に戻せる personal learning loop を持てます。</li>
            <li>Stripe Billing Portal を使うので、支払い方法変更や解約フローをアプリ内で独自実装しません。</li>
            <li>Webhook 反映中でも account 画面から状態確認を続けられます。</li>
          </ul>

          <p className={styles.lead}>
            判断の深さを見に行くなら `Decisions`、エピソード全体を追うなら `Episodes` に戻れます。
          </p>
          <div className={styles.ctaRow}>
            <Link href="/decisions" className={styles.primaryLink}>
              Decisionsへ戻る
            </Link>
            <Link href="/episodes" className={styles.secondaryLink}>
              Episodes
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
