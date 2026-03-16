import AnalyticsPageView from "@/app/components/AnalyticsPageView";
import TrackedLink from "@/app/components/TrackedLink";
import { buildLoginPath, buildOnboardingPath } from "@/app/lib/onboarding";
import { getViewerFromCookies } from "@/app/lib/viewer";
import styles from "./home.module.css";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "あなた専用のAIポッドキャストを毎日届ける | AI Podcast",
  description: "関心に合わせてAIが毎日ポッドキャストを生成。聴くだけで情報が整理され、判断ポイントも一目でわかる。"
};

const SAMPLE_EPISODES = [
  {
    title: "今週チェックすべきAIツール3選",
    genre: "テクノロジー",
    duration: "8分",
    cards: 3,
    summary: "話題のAIツールを実用性の視点で比較し、今すぐ試すべきか判断します。"
  },
  {
    title: "サブスク見直し — 今月解約してもいいもの",
    genre: "マネー",
    duration: "6分",
    cards: 2,
    summary: "利用頻度が落ちているサブスクを棚卸しして、解約タイミングを整理します。"
  },
  {
    title: "週末に読むべき記事ダイジェスト",
    genre: "ニュース",
    duration: "10分",
    cards: 4,
    summary: "今週の注目記事をピックアップし、読むべき優先度とともにお届けします。"
  }
] as const;

export default async function HomePage() {
  const viewer = await getViewerFromCookies();

  const onboardingHref = buildOnboardingPath("/decisions");
  const loginHref = buildLoginPath("/decisions");
  const startHref = viewer ? "/decisions" : loginHref;
  const startLabel = viewer ? "今日のエピソードを聴く" : "無料ではじめる";
  const secondaryHref = viewer ? onboardingHref : loginHref;
  const secondaryLabel = viewer ? "好みを設定する" : "ログイン";

  return (
    <main className={styles.page}>
      <AnalyticsPageView page="/" pageEventName="landing_view" />

      <div className={styles.shell}>
        {/* --- Hero --- */}
        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>AI Podcast</p>
            <h1>欲しい情報だけを、毎日ポッドキャストで届ける。</h1>
            <p className={styles.lead}>
              あなたの関心に合わせてAIがエピソードを生成。
              通勤中や家事の合間に聴くだけで、情報が整理され判断ポイントも見えてきます。
            </p>

            <div className={styles.ctaRow}>
              <TrackedLink
                href={startHref}
                className={styles.primaryLink}
                eventName="landing_start_click"
                eventProperties={{
                  page: "/",
                  source: "landing_primary",
                  destination: startHref
                }}
              >
                {startLabel}
              </TrackedLink>
              <TrackedLink
                href={secondaryHref}
                className={styles.secondaryLink}
                eventName="landing_cta_click"
                eventProperties={{
                  page: "/",
                  source: "landing_secondary",
                  destination: secondaryHref
                }}
              >
                {secondaryLabel}
              </TrackedLink>
            </div>

            <div className={styles.stats}>
              <article className={styles.stat}>
                <span>毎日更新</span>
                <strong>あなた専用のエピソード</strong>
              </article>
              <article className={styles.stat}>
                <span>ながら聴き</span>
                <strong>通勤・家事の合間にインプット</strong>
              </article>
              <article className={styles.stat}>
                <span>判断カード</span>
                <strong>聴いた内容を行動に変える</strong>
              </article>
            </div>
          </div>

          <aside className={styles.sampleCard}>
            <div className={styles.sampleHeader}>
              <span className={styles.sampleLabel}>最新エピソード</span>
              <span className={styles.sampleBadge}>8分</span>
            </div>
            <h2>今週チェックすべきAIツール3選</h2>
            <p className={styles.sampleSummary}>
              話題のAIツールを実用性の視点で比較し、今すぐ試すべきか判断します。
            </p>
            <dl className={styles.sampleMeta}>
              <div>
                <dt>ジャンル</dt>
                <dd>テクノロジー</dd>
              </div>
              <div>
                <dt>判断カード</dt>
                <dd>3件の判断ポイント</dd>
              </div>
              <div>
                <dt>更新</dt>
                <dd>毎日あなたの関心に合わせて生成</dd>
              </div>
            </dl>
          </aside>
        </section>

        {/* --- How it works --- */}
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <p className={styles.eyebrow}>仕組み</p>
            <h2>聴くだけで情報が整理される</h2>
          </div>
          <div className={styles.featureGrid}>
            <article className={styles.featureCard}>
              <h3>1. 好みを伝える</h3>
              <p>関心のあるジャンルやトピックを設定するだけ。AIがあなた専用のエピソードを毎日つくります。</p>
            </article>
            <article className={styles.featureCard}>
              <h3>2. ポッドキャストを聴く</h3>
              <p>通勤中、ランニング中、家事の合間に。ながら聴きで最新情報をキャッチアップできます。</p>
            </article>
            <article className={styles.featureCard}>
              <h3>3. 判断カードで行動する</h3>
              <p>エピソードから抽出された判断ポイントをカードで確認。聴いた内容をすぐ行動に変えられます。</p>
            </article>
          </div>
        </section>

        {/* --- Sample Episodes --- */}
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <p className={styles.eyebrow}>エピソード例</p>
            <h2>こんなエピソードが届きます</h2>
            <p className={styles.sectionLead}>テクノロジー、マネー、ニュースなど幅広いジャンルをカバー。あなたの関心に合わせて優先度が変わります。</p>
          </div>
          <div className={styles.sampleGrid}>
            {SAMPLE_EPISODES.map((episode) => (
              <article key={episode.title} className={styles.samplePanel}>
                <div className={styles.samplePanelHeader}>
                  <span className={styles.samplePanelBadge}>{episode.duration}</span>
                  <span className={styles.samplePanelGenre}>{episode.genre}</span>
                </div>
                <h3>{episode.title}</h3>
                <p>{episode.summary}</p>
                <dl className={styles.samplePanelMeta}>
                  <div>
                    <dt>判断カード</dt>
                    <dd>{episode.cards}件のポイント</dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
        </section>

        {/* --- Membership --- */}
        <section className={`${styles.section} ${styles.membershipSection}`.trim()}>
          <div className={styles.sectionHeader}>
            <p className={styles.eyebrow}>プラン</p>
            <h2>無料で聴ける。有料でもっと深く。</h2>
            <p className={styles.sectionLead}>
              エピソードの再生と判断カードの概要は無料。有料版ではフルスクリプト、行動提案、アーカイブが使えます。
            </p>
          </div>
          <div className={styles.membershipGrid}>
            <article className={styles.membershipCard}>
              <span className={styles.membershipTier}>無料</span>
              <h3>毎日のエピソードを聴いて情報をキャッチアップ</h3>
              <p>ポッドキャスト再生、判断カードの概要確認、好みの設定ができます。</p>
              <ul className={styles.membershipList}>
                <li>毎日のエピソード再生</li>
                <li>判断カードのタイトルと概要</li>
                <li>好みの設定とおすすめの最適化</li>
              </ul>
            </article>
            <article className={styles.membershipCard}>
              <span className={styles.membershipTier}>有料</span>
              <h3>フルスクリプトと行動提案で判断を加速</h3>
              <p>エピソードの文字起こし、具体的な行動提案、過去エピソードのアーカイブが利用できます。</p>
              <ul className={styles.membershipList}>
                <li>エピソードのフルスクリプト</li>
                <li>判断カードの行動提案とタイミング</li>
                <li>過去エピソードのアーカイブ</li>
              </ul>
            </article>
          </div>
        </section>

        {/* --- CTA Footer --- */}
        <section className={`${styles.section} ${styles.ctaSection}`.trim()}>
          <div className={styles.sectionHeader}>
            <p className={styles.eyebrow}>はじめよう</p>
            <h2>今日のエピソードを聴いてみよう</h2>
            <p className={styles.sectionLead}>
              好みを設定して、あなた専用のポッドキャストを受け取りましょう。
            </p>
          </div>
          <div className={styles.ctaRow}>
            <TrackedLink
              href={startHref}
              className={styles.primaryLink}
              eventName="landing_start_click"
              eventProperties={{
                page: "/",
                source: "landing_footer_primary",
                destination: startHref
              }}
            >
              {startLabel}
            </TrackedLink>
            <TrackedLink
              href={secondaryHref}
              className={styles.secondaryLink}
              eventName="landing_cta_click"
              eventProperties={{
                page: "/",
                source: "landing_footer_secondary",
                destination: secondaryHref
              }}
            >
              {secondaryLabel}
            </TrackedLink>
          </div>
        </section>
      </div>
    </main>
  );
}
