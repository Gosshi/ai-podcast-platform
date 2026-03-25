import Link from "next/link";
import { requireAdmin } from "@/app/lib/adminGuard";
import ManualPublishJaPanel from "./ManualPublishJaPanel";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

const resolveJstTodayDate = (): string => {
  const now = new Date();
  const shifted = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const year = shifted.getUTCFullYear();
  const month = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const day = String(shifted.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export default async function AdminManualPublishPage() {
  await requireAdmin("/admin/manual-publish");

  return (
    <main className={styles.page}>
      <div className={styles.headerRow}>
        <div>
          <p className={styles.eyebrow}>Admin Publish</p>
          <h1>Manual Public Episode</h1>
          <p className={styles.caption}>
            JA の公開回を admin 上から登録し、judgment card 同期、TTS、published 反映までまとめて実行します。
          </p>
        </div>
        <div className={styles.navRow}>
          <Link href="/admin/trends">/admin/trends</Link>
          <Link href="/admin/job-runs">/admin/job-runs</Link>
          <Link href="/admin/analytics">/admin/analytics</Link>
        </div>
      </div>

      <section className={styles.panel}>
        <h2>Scope</h2>
        <ul className={styles.list}>
          <li>soft launch 中の JA 公開回を手動で本番 feed に載せるための admin ツールです。</li>
          <li>入力は `title / description / preview / script / episodeDate / genre` を基本とします。</li>
          <li>既存の episode を上書きしたい場合だけ `existingEpisodeId` を指定してください。</li>
        </ul>
      </section>

      <ManualPublishJaPanel defaultEpisodeDate={resolveJstTodayDate()} />
    </main>
  );
}
