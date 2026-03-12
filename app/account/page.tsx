import Link from "next/link";
import MemberControls from "@/app/components/MemberControls";
import { getViewerFromCookies } from "@/app/lib/viewer";
import styles from "../home.module.css";

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

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <section className={styles.section}>
          <p className={styles.eyebrow}>Account</p>
          <h1>会員ステータス</h1>
          <p className={styles.lead}>
            支払い完了後の戻り先です。webhook が反映されると paid 状態へ切り替わります。
          </p>
          {subscription === "success" ? (
            <p className={`${styles.statusMessage} ${styles.success}`}>
              Checkout は完了しました。数秒後に会員状態が更新されます。
            </p>
          ) : null}
          {subscription === "cancel" ? (
            <p className={`${styles.statusMessage} ${styles.cancel}`}>
              Checkout はキャンセルされました。無料版のまま利用できます。
            </p>
          ) : null}
          <MemberControls
            viewer={viewer}
            title="現在のプラン"
            copy="Stripe webhook で `subscriptions` が更新されると、ここが paid に変わります。"
          />
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
