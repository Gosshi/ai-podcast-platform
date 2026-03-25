import { requireAdmin } from "@/app/lib/adminGuard";
import ManualPublishJaPanel from "./ManualPublishJaPanel";
import s from "../admin.module.css";

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
    <main className={s.container}>
      <div className={s.pageHeader}>
        <h1 className={s.pageTitle}>Manual Publish</h1>
        <p className={s.pageCaption}>
          JA の公開回を admin 上から登録し、judgment card 同期、TTS、published 反映までまとめて実行します。
        </p>
      </div>

      <section className={s.card}>
        <h2 className={s.cardHeader}>Scope</h2>
        <ul className={s.scopeList}>
          <li>soft launch 中の JA 公開回を手動で本番 feed に載せるための admin ツールです。</li>
          <li>入力は title / description / preview / script / episodeDate / genre を基本とします。</li>
          <li>既存の episode を上書きしたい場合だけ existingEpisodeId を指定してください。</li>
        </ul>
      </section>

      <ManualPublishJaPanel defaultEpisodeDate={resolveJstTodayDate()} />
    </main>
  );
}
