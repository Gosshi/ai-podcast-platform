import Link from "next/link";
import AlertsInbox from "@/app/components/AlertsInbox";
import AnalyticsPageView from "@/app/components/AnalyticsPageView";
import MemberControls from "@/app/components/MemberControls";
import NotificationPreferencesForm from "@/app/components/NotificationPreferencesForm";
import { syncUserAlerts } from "@/app/lib/alerts";
import { buildOnboardingPath, resolveSafeNextPath } from "@/app/lib/onboarding";
import {
  formatMembershipDate,
  resolveMembershipBadgeLabel,
  resolveMembershipStatusLabel,
  resolvePaymentStateLabel,
  resolvePlanName
} from "@/app/lib/membership";
import { getViewerFromCookies } from "@/app/lib/viewer";
import {
  ACTIVE_SUBSCRIPTION_LABELS,
  BUDGET_SENSITIVITY_LABELS,
  DAILY_AVAILABLE_TIME_LABELS,
  DECISION_PRIORITY_LABELS,
  INTEREST_TOPIC_LABELS,
  type ActiveSubscription,
  type BudgetSensitivity,
  type DailyAvailableTime,
  type DecisionPriority,
  type InterestTopic
} from "@/src/lib/userPreferences";
import styles from "./page.module.css";

type SearchParams = {
  subscription?: string | string[];
  next?: string | string[];
};

const readParam = (value: string | string[] | undefined): string | null => {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
};

const formatSelectionList = <T extends string>(
  values: T[] | null | undefined,
  labels: Record<T, string>,
  fallback = "未設定"
): string => {
  if (!values?.length) {
    return fallback;
  }

  return values.map((value) => labels[value]).join(", ");
};

const formatSingleSelection = <T extends string>(
  value: T | null | undefined,
  labels: Record<T, string>,
  fallback = "未設定"
): string => {
  if (!value) {
    return fallback;
  }

  return labels[value];
};

export default async function AccountPage({
  searchParams
}: {
  searchParams: Promise<SearchParams>;
}) {
  const viewer = await getViewerFromCookies();
  const params = await searchParams;
  const alertState = viewer
    ? await syncUserAlerts(viewer)
    : {
        alerts: [],
        preferences: null,
        error: null
      };
  const subscription = readParam(params.subscription);
  const authRedirectPath = resolveSafeNextPath(readParam(params.next), "/decisions");
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
      <AnalyticsPageView page="/account" pageEventName="account_view" />
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
            analyticsSource="/account"
            authRedirectPath={authRedirectPath}
          />
        </section>

        {viewer ? (
          <AlertsInbox
            alerts={alertState.alerts.slice(0, 4)}
            page="/account"
            title="Retention Alerts"
            lead="in-app alerts の現在地を Account から確認し、free / paid 差分もここで把握できます。"
            showViewAllLink={alertState.alerts.length > 4}
          />
        ) : null}
        {alertState.error ? <p className={styles.sectionLead}>alerts の同期に失敗しました: {alertState.error}</p> : null}

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
              <strong className={styles.statValue}>{viewer?.isPaid ? "詳しい解説を表示" : "短いプレビューを表示"}</strong>
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
              <h3>詳しい解説</h3>
              <p>各テーマの背景や判断理由を、途中で省略されずに追えます。</p>
            </article>
            <article className={styles.featureCard}>
              <h3>アーカイブと管理</h3>
              <p>過去エピソードをさかのぼりつつ、支払い方法や解約も Billing Portal で自分で管理できます。</p>
            </article>
            <article className={styles.featureCard}>
              <h3>あなたの傾向</h3>
              <p>履歴から好みの傾向を見つけて、次に見る候補の補足として返します。</p>
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

        {viewer ? (
          <section className={styles.section}>
            <div>
              <p className={styles.eyebrow}>Preference Setup</p>
              <h2>Onboarding と判断嗜好の設定</h2>
              <p className={styles.sectionLead}>
                最初に設定した好みと、使いながらたまる履歴の両方を使って、おすすめの並びや補足を整えます。
              </p>
            </div>

            <div className={styles.statsGrid}>
              <article className={styles.statCard}>
                <span className={styles.statLabel}>Onboarding</span>
                <strong className={styles.statValue}>{viewer.needsOnboarding ? "未完了" : "完了済み"}</strong>
              </article>
              <article className={styles.statCard}>
                <span className={styles.statLabel}>興味ジャンル</span>
                <strong className={styles.statValue}>
                  {formatSelectionList<InterestTopic>(viewer.preferences?.interestTopics, INTEREST_TOPIC_LABELS)}
                </strong>
              </article>
              <article className={styles.statCard}>
                <span className={styles.statLabel}>利用サービス</span>
                <strong className={styles.statValue}>
                  {formatSelectionList<ActiveSubscription>(
                    viewer.preferences?.activeSubscriptions,
                    ACTIVE_SUBSCRIPTION_LABELS
                  )}
                </strong>
              </article>
              <article className={styles.statCard}>
                <span className={styles.statLabel}>判断優先</span>
                <strong className={styles.statValue}>
                  {formatSingleSelection<DecisionPriority>(viewer.preferences?.decisionPriority, DECISION_PRIORITY_LABELS)}
                </strong>
              </article>
              <article className={styles.statCard}>
                <span className={styles.statLabel}>使える時間</span>
                <strong className={styles.statValue}>
                  {formatSingleSelection<DailyAvailableTime>(
                    viewer.preferences?.dailyAvailableTime,
                    DAILY_AVAILABLE_TIME_LABELS
                  )}
                </strong>
              </article>
              <article className={styles.statCard}>
                <span className={styles.statLabel}>予算感度</span>
                <strong className={styles.statValue}>
                  {formatSingleSelection<BudgetSensitivity>(
                    viewer.preferences?.budgetSensitivity,
                    BUDGET_SENSITIVITY_LABELS
                  )}
                </strong>
              </article>
            </div>

            <div className={styles.ctaRow}>
              <Link href={buildOnboardingPath("/account")} className={styles.primaryLink}>
                {viewer.needsOnboarding ? "好みを設定する" : "好みを見直す"}
              </Link>
              <Link href="/decisions" className={styles.secondaryLink}>
                おすすめを見る
              </Link>
            </div>
          </section>
        ) : null}

        {viewer && alertState.preferences ? (
          <section className={styles.section}>
            <div>
              <p className={styles.eyebrow}>Notification Preferences</p>
              <h2>軽量な alert 設定</h2>
              <p className={styles.sectionLead}>
                MVP では in-app alerts の ON / OFF だけを持ちます。将来は email / push / snooze / mute に展開する前提です。
              </p>
            </div>

            <NotificationPreferencesForm preferences={alertState.preferences} />
          </section>
        ) : null}
      </div>
    </main>
  );
}
