import { redirect } from "next/navigation";
import AdminAccessForm from "./AdminAccessForm";
import {
  hasValidAdminAccessCookie,
  isAdminAccessGateEnabled,
  normalizeAdminNextPath
} from "@/app/lib/adminAccess";
import { requireAdminIdentity } from "@/app/lib/adminGuard";
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

export default async function AdminAccessPage({
  searchParams
}: {
  searchParams: Promise<SearchParams>;
}) {
  const viewer = await requireAdminIdentity();
  const params = await searchParams;
  const nextPath = normalizeAdminNextPath(readParam(params.next));

  if (!isAdminAccessGateEnabled()) {
    redirect(nextPath);
  }

  if (await hasValidAdminAccessCookie(viewer.userId)) {
    redirect(nextPath);
  }

  return (
    <main className={styles.page}>
      <section className={styles.panel}>
        <p className={styles.eyebrow}>Admin Access</p>
        <h1 className={styles.title}>管理者アクセスの追加確認</h1>
        <p className={styles.lead}>
          管理画面には通常の会員ログインに加えて、登録済み管理者メール宛てに送信される
          ワンタイム確認コードが必要です。誤入力が10回続くと一定時間ロックされます。
        </p>

        <AdminAccessForm nextPath={nextPath} />

        <p className={styles.meta}>確認後は {nextPath} に移動します。</p>
      </section>
    </main>
  );
}
