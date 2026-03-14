import { redirect } from "next/navigation";
import AnalyticsPageView from "@/app/components/AnalyticsPageView";
import MemberControls from "@/app/components/MemberControls";
import { buildOnboardingPath, resolveSafeNextPath } from "@/app/lib/onboarding";
import { getViewerFromCookies } from "@/app/lib/viewer";
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

export default async function LoginPage({
  searchParams
}: {
  searchParams: Promise<SearchParams>;
}) {
  const viewer = await getViewerFromCookies();
  const params = await searchParams;
  const nextPath = resolveSafeNextPath(readParam(params.next), "/decisions");

  if (viewer) {
    redirect(buildOnboardingPath(nextPath));
  }

  return (
    <main className={styles.page}>
      <AnalyticsPageView page="/login" pageEventName="account_view" />
      <section className={styles.hero}>
        <div className={styles.copy}>
          <p className={styles.eyebrow}>ログイン</p>
          <h1>まずログインして、判断の前提をそろえます。</h1>
          <p className={styles.lead}>
            ログイン後は onboarding で好みや使っているサービスを確認し、そのまま今日の判断へ進みます。
          </p>
          <div className={styles.metaGrid}>
            <article className={styles.metaCard}>
              <span>次の流れ</span>
              <strong>ログイン → 初回設定 → 今日の判断</strong>
            </article>
            <article className={styles.metaCard}>
              <span>無料版で見られるもの</span>
              <strong>判断タイトル / かんたんな説明</strong>
            </article>
            <article className={styles.metaCard}>
              <span>有料版で見られるもの</span>
              <strong>判断理由 / 次の行動 / 見直しタイミング / 履歴分析</strong>
            </article>
          </div>
        </div>

        <MemberControls
          viewer={null}
          title="メールでログイン"
          copy="ログイン後は必ず初回設定へ進みます。設定がある場合も、そのまま見直してから判断画面へ戻れます。"
          analyticsSource="/login"
          authRedirectPath={nextPath}
        />
      </section>
    </main>
  );
}
