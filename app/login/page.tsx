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
          <h1>ログインして、あなた専用のポッドキャストを受け取る。</h1>
          <p className={styles.lead}>
            ログイン後に好みを設定すると、関心に合わせたエピソードが毎日届きます。
          </p>
          <div className={styles.metaGrid}>
            <article className={styles.metaCard}>
              <span>次の流れ</span>
              <strong>ログイン → 好み設定 → 今日のエピソード</strong>
            </article>
            <article className={styles.metaCard}>
              <span>無料版</span>
              <strong>エピソード再生 / トピックカード概要</strong>
            </article>
            <article className={styles.metaCard}>
              <span>有料版</span>
              <strong>フルスクリプト / 行動提案 / アーカイブ無制限</strong>
            </article>
          </div>
        </div>

        <MemberControls
          viewer={null}
          title="メールでログイン"
          copy="ログイン後は好みの設定へ進みます。設定済みの場合もそのまま見直してからエピソードへ戻れます。"
          analyticsSource="/login"
          authRedirectPath={nextPath}
        />
      </section>
    </main>
  );
}
