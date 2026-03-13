import { redirect } from "next/navigation";
import AnalyticsPageView from "@/app/components/AnalyticsPageView";
import { resolveSafeNextPath } from "@/app/lib/onboarding";
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
  if (!viewer) {
    redirect("/account");
  }

  const params = await searchParams;
  const nextPath = resolveSafeNextPath(readParam(params.next));

  return (
    <main className={styles.page}>
      <AnalyticsPageView page="/onboarding" pageEventName="onboarding_view" />
      <div className={styles.shell}>
        <section className={styles.hero}>
          <div className={styles.copy}>
            <p className={styles.eyebrow}>User Onboarding</p>
            <h1>最初の数問で、Decision Engine の personalisation 基盤を作る。</h1>
            <p className={styles.lead}>
              興味ジャンル、利用中のサービス、判断で優先したいこと、使える時間、任意の予算感度を取得して
              user_preferences を初期化します。ここで集めた explicit preference は cold start の補助として
              ranking / hints / alerts / paywall に渡せる形で保存します。
            </p>
            <div className={styles.metaGrid}>
              <article className={styles.metaCard}>
                <span>収集する情報</span>
                <strong>topics / subscriptions / priorities / time / budget</strong>
              </article>
              <article className={styles.metaCard}>
                <span>保存先</span>
                <strong>Supabase user_preferences</strong>
              </article>
              <article className={styles.metaCard}>
                <span>完了後の遷移</span>
                <strong>{nextPath}</strong>
              </article>
            </div>
          </div>

          <OnboardingFlow initialPreferences={viewer.preferences} nextPath={nextPath} isFirstRun={viewer.needsOnboarding} />
        </section>
      </div>
    </main>
  );
}
