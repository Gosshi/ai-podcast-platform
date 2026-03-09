import Link from "next/link";
import MemberControls from "@/app/components/MemberControls";
import { getViewerFromCookies } from "@/app/lib/viewer";
import styles from "./home.module.css";

export default async function HomePage() {
  const viewer = await getViewerFromCookies();

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>Paid Membership MVP</p>
            <h1>判断カードに課金できる、音声インテリジェンスへ。</h1>
            <p className={styles.lead}>
              無料版は短いプレビューまで。有料会員になると、DeepDiveの全文、判断カード、過去アーカイブを開放し、
              「今使うか、待つか、切るか」を短時間で判断できる状態を作ります。
            </p>
            <div className={styles.ctaRow}>
              <Link href="/episodes" className={styles.primaryLink}>
                Episodesを見る
              </Link>
              <Link href="/account" className={styles.secondaryLink}>
                Account
              </Link>
              <Link href="/letters" className={styles.secondaryLink}>
                Letterを送る
              </Link>
            </div>
            <div className={styles.stats}>
              <div className={styles.stat}>
                <strong>Free</strong>
                タイトル、音声、短いプレビュー
              </div>
              <div className={styles.stat}>
                <strong>Paid</strong>
                判断カード、DeepDive全文、アーカイブ
              </div>
              <div className={styles.stat}>
                <strong>Stripe</strong>
                `pro_monthly` の最小課金実験
              </div>
            </div>
          </div>
          <MemberControls viewer={viewer} title="今の会員状態" />
        </section>

        <section className={styles.section}>
          <h2>このMVPでできること</h2>
          <ul className={styles.list}>
            <li>Supabase Auth で最小ログインし、free / paid を判定</li>
            <li>`write-script-ja` と `polish-script-ja` から判断カードを保存</li>
            <li>`/episodes` で無料プレビューと有料DeepDiveをゲート</li>
            <li>Stripe subscription checkout と webhook で entitlement を更新</li>
          </ul>
        </section>
      </div>
    </main>
  );
}
