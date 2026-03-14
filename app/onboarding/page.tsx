import AnalyticsPageView from "@/app/components/AnalyticsPageView";
import TrackedLink from "@/app/components/TrackedLink";
import { buildAccountEntryPath, resolveSafeNextPath } from "@/app/lib/onboarding";
import { getViewerFromCookies } from "@/app/lib/viewer";
import OnboardingFlow from "./OnboardingFlow";
import styles from "./page.module.css";

type SearchParams = {
  next?: string | string[];
};

const readParam = (value: string | string[] | undefined): string | null => {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
};

export const dynamic = "force-dynamic";

export default async function OnboardingPage({
  searchParams
}: {
  searchParams: Promise<SearchParams>;
}) {
  const viewer = await getViewerFromCookies();
  const params = await searchParams;
  const nextPath = resolveSafeNextPath(readParam(params.next));
  const nextPathLabel = nextPath === "/decisions" ? "今日のおすすめ" : "次の画面";
  const accountEntryPath = buildAccountEntryPath(`/onboarding?next=${encodeURIComponent(nextPath)}`);

  return (
    <main className={styles.page}>
      <AnalyticsPageView page="/onboarding" pageEventName="onboarding_view" />
      <div className={styles.shell}>
        <section className={styles.hero}>
          <div className={styles.copy}>
            <p className={styles.eyebrow}>はじめに</p>
            <h1>判断の傾向を先に教えてください。</h1>
            <p className={styles.lead}>
              最初に好みや使っているサービスを入れておくと、今日のおすすめや見直しタイミングがあなた向けに整います。
              数問で終わるので、先に済ませておくとこのあと迷いにくくなります。
            </p>
            <div className={styles.metaGrid}>
              <article className={styles.metaCard}>
                <span>設定する内容</span>
                <strong>気になる領域 / 利用中サービス / 重視したいこと / 使える時間</strong>
              </article>
              <article className={styles.metaCard}>
                <span>所要時間</span>
                <strong>約1分</strong>
              </article>
              <article className={styles.metaCard}>
                <span>完了後の遷移</span>
                <strong>{nextPathLabel}</strong>
              </article>
            </div>
          </div>

          {viewer ? (
            <OnboardingFlow initialPreferences={viewer.preferences} nextPath={nextPath} isFirstRun={viewer.needsOnboarding} />
          ) : (
            <section className={styles.panel}>
              <div className={styles.stepHeader}>
                <p className={styles.stepEyebrow}>ログイン</p>
                <h2>続ける前にログインしてください</h2>
                <p>ログインすると設定内容を保存し、そのまま {nextPathLabel} へ進めます。</p>
              </div>
              <div className={styles.actionRow}>
                <TrackedLink
                  href={accountEntryPath}
                  className={styles.primaryButton}
                  eventName="onboarding_entry_click"
                  eventProperties={{
                    page: "/onboarding",
                    source: "onboarding_login_gate",
                    destination: accountEntryPath
                  }}
                >
                  ログインして続ける
                </TrackedLink>
              </div>
            </section>
          )}
        </section>
      </div>
    </main>
  );
}
