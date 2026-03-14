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
            <p className={styles.eyebrow}>アカウント</p>
            <h1>プランと請求を、迷わず確認して管理する。</h1>
            <p className={styles.lead}>
              現在のプラン、利用状態、次回更新日、支払い状態を一画面で確認できます。利用中は
              支払い設定 から更新や解約も進められます。
            </p>
            {subscription === "success" && viewer?.isPaid ? (
              <p className={`${styles.statusMessage} ${styles.success}`}>
                有料会員への切り替えが完了しました。迷いを減らし、判断を早く進めるための機能が使えます。
              </p>
            ) : null}
            {subscription === "success" && !viewer?.isPaid ? (
              <p className={`${styles.statusMessage} ${styles.info}`}>
                購入手続きは完了しています。反映まで数秒かかることがあるため、少し待ってから再読み込みすると最新状態を確認できます。
              </p>
            ) : null}
            {subscription === "cancel" ? (
              <p className={`${styles.statusMessage} ${styles.cancel}`}>
                購入手続きはキャンセルされました。無料版のまま判断の要点を確認でき、必要になった時点で再開できます。
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
            title="継続チェック"
            lead="期限が近いものや見直したい項目を、アカウントからまとめて確認できます。"
            showViewAllLink={alertState.alerts.length > 4}
          />
        ) : null}
        {alertState.error ? <p className={styles.sectionLead}>お知らせの読み込みに失敗しました。再読み込みしてください。</p> : null}

        <section className={styles.section}>
          <div>
            <p className={styles.eyebrow}>会員情報</p>
            <h2>現在の会員状態</h2>
            <p className={styles.sectionLead}>今のプランと次にできることを、ひと目で把握できるようにしています。</p>
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
              <span className={styles.statLabel}>プラン管理</span>
              <strong className={styles.statValue}>{viewer?.stripeCustomerId ? "支払い設定から変更可能" : "ログイン後に表示"}</strong>
            </article>
            <article className={styles.statCard}>
              <span className={styles.statLabel}>判断カード</span>
              <strong className={styles.statValue}>{viewer?.isPaid ? "全文を表示" : "プレビューまで"}</strong>
            </article>
            <article className={styles.statCard}>
              <span className={styles.statLabel}>詳しい解説</span>
              <strong className={styles.statValue}>{viewer?.isPaid ? "詳しい解説を表示" : "短いプレビューを表示"}</strong>
            </article>
          </div>
        </section>

        <section className={styles.section}>
          <div>
            <p className={styles.eyebrow}>有料版でできること</p>
            <h2>{viewer?.isPaid ? "有料会員で使えること" : "有料会員になるとできること"}</h2>
            <p className={styles.sectionLead}>有料版で得られる成果を、わかりやすくまとめています。</p>
          </div>

          <div className={styles.featureGrid}>
            <article className={styles.featureCard}>
              <h3>締切を逃しにくくなる</h3>
              <p>見直しタイミングが分かるので、後回しにした判断を放置しにくくなります。</p>
            </article>
            <article className={styles.featureCard}>
              <h3>迷いが減る</h3>
              <p>理由と次の行動まで見えるので、その場で止まらずに判断できます。</p>
            </article>
            <article className={styles.featureCard}>
              <h3>判断が早くなる</h3>
              <p>結果と履歴がたまるほど、自分に合う判断パターンを再利用しやすくなります。</p>
            </article>
            <article className={styles.featureCard}>
              <h3>次の判断が整う</h3>
              <p>履歴から好みの傾向を見つけて、次のおすすめに補足として返します。</p>
            </article>
          </div>

          <ul className={styles.list}>
            <li>無料版は判断サマリーの入口まで。有料版は「どう動くか」を決める材料まで開放します。</li>
            <li>有料版では履歴から傾向を見つけて、次の判断に活かせます。</li>
            <li>支払い方法の変更や解約も、この画面から進められます。</li>
            <li>反映中でもアカウント画面から状態確認を続けられます。</li>
          </ul>

          <p className={styles.lead}>判断を見直すなら「今日のおすすめ」へ戻れます。</p>
          <div className={styles.ctaRow}>
            <Link href="/decisions" className={styles.primaryLink}>
              今日のおすすめへ戻る
            </Link>
            <Link href="/episodes" className={styles.secondaryLink}>
              詳細を見る
            </Link>
          </div>
        </section>

        {viewer ? (
          <section className={styles.section}>
            <div>
              <p className={styles.eyebrow}>好み設定</p>
              <h2>初回設定と好みの見直し</h2>
              <p className={styles.sectionLead}>
                最初に設定した好みと、使いながらたまる履歴の両方を使って、おすすめの並びや補足を整えます。
              </p>
            </div>

            <div className={styles.statsGrid}>
              <article className={styles.statCard}>
                <span className={styles.statLabel}>初回設定</span>
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
                今日のおすすめを見る
              </Link>
            </div>
          </section>
        ) : null}

        {viewer && alertState.preferences ? (
          <section className={styles.section}>
            <div>
              <p className={styles.eyebrow}>お知らせ設定</p>
              <h2>お知らせの受け取り方</h2>
              <p className={styles.sectionLead}>必要なお知らせだけ受け取れるように切り替えられます。</p>
            </div>

            <NotificationPreferencesForm preferences={alertState.preferences} />
          </section>
        ) : null}
      </div>
    </main>
  );
}
