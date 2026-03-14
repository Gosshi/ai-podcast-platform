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
  const nextPathLabel = nextPath === "/decisions" ? "今日の判断" : "次の画面";

  return (
    <main className={styles.page}>
      <AnalyticsPageView page="/onboarding" pageEventName="onboarding_view" />
      <div className={styles.shell}>
        <section className={styles.hero}>
          <div className={styles.copy}>
            <p className={styles.eyebrow}>はじめに</p>
            <h1>よく見る作品や使っているサービスを先に教えてください。</h1>
            <p className={styles.lead}>
              最初に好みを入れておくと、今日のおすすめや見直しタイミングがあなた向けに整います。数問で終わるので、
              先に済ませておくとこのあと迷いにくくなります。
            </p>
            <div className={styles.metaGrid}>
              <article className={styles.metaCard}>
                <span>設定する内容</span>
                <strong>ジャンル / 利用中サービス / 重視したいこと / 使える時間</strong>
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

          <OnboardingFlow initialPreferences={viewer.preferences} nextPath={nextPath} isFirstRun={viewer.needsOnboarding} />
        </section>
      </div>
    </main>
  );
}
