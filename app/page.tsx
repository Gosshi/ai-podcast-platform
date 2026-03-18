import AnalyticsPageView from "@/app/components/AnalyticsPageView";
import TrackedLink from "@/app/components/TrackedLink";
import { buildLoginPath, buildOnboardingPath } from "@/app/lib/onboarding";
import { getViewerFromCookies } from "@/app/lib/viewer";
import styles from "./home.module.css";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "通勤中に聴くだけで、今日の情報が整理される | AI Podcast",
  description: "最新トレンドからAIが毎日ポッドキャストを生成。聴くだけで情報が整理され、要点をカードで確認できる。"
};

const SAMPLE_EPISODES = [
  {
    title: "今週チェックすべきAIツール3選",
    genre: "テクノロジー",
    duration: "8分",
    cards: 3,
    summary: "話題のAIツールを実用性の視点で比較し、今すぐ試すべきかお伝えします。"
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
            <h1>通勤中に聴くだけで、今日の情報が整理される。</h1>
            <p className={styles.lead}>
              あなたの関心に合わせてAIがエピソードを毎日生成。
              イヤホンで聴くだけで、最新情報のキャッチアップが終わります。
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
                ▶ {startLabel}
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
                <span>ながら聴き</span>
                <strong>通勤・家事の合間に5〜10分</strong>
              </article>
              <article className={styles.stat}>
                <span>毎日更新</span>
                <strong>AIが毎朝エピソードを自動生成</strong>
              </article>
              <article className={styles.stat}>
                <span>トピックカード</span>
                <strong>聴いた内容を行動に変える</strong>
              </article>
            </div>
          </div>

          <aside className={styles.sampleCard}>
            <div className={styles.sampleHeader}>
              <span className={styles.sampleLabel}>Now Playing</span>
              <span className={styles.sampleBadge}>8分</span>
            </div>
            <h2>今週チェックすべきAIツール3選</h2>
            <p className={styles.sampleSummary}>
              話題のAIツールを実用性の視点で比較し、今すぐ試すべきかお伝えします。
            </p>
            <div className={styles.sampleWave}>
              <div className={styles.waveBar} />
              <div className={styles.waveBar} />
              <div className={styles.waveBar} />
              <div className={styles.waveBar} />
              <div className={styles.waveBar} />
              <div className={styles.waveBar} />
              <div className={styles.waveBar} />
              <div className={styles.waveBar} />
              <div className={styles.waveBar} />
              <div className={styles.waveBar} />
              <div className={styles.waveBar} />
              <div className={styles.waveBar} />
            </div>
            <dl className={styles.sampleMeta}>
              <div>
                <dt>ジャンル</dt>
                <dd>テクノロジー</dd>
              </div>
              <div>
                <dt>トピックカード</dt>
                <dd>3件のポイント</dd>
              </div>
            </dl>
          </aside>
        </section>

        {/* --- How it works --- */}
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <p className={styles.eyebrow}>仕組み</p>
            <h2>聴くだけで情報が整理される、3ステップ</h2>
          </div>
          <div className={styles.featureGrid}>
            <article className={styles.featureCard}>
              <h3>1. 好みを30秒で設定</h3>
              <p>関心のあるジャンルを選ぶだけ。AIが最新トレンドからエピソードを毎朝つくります。</p>
            </article>
            <article className={styles.featureCard}>
              <h3>2. 通勤中にイヤホンで聴く</h3>
              <p>5〜10分のエピソードだから、電車1駅分でインプット完了。ながら聴きに最適です。</p>
            </article>
            <article className={styles.featureCard}>
              <h3>3. カードでポイントを確認</h3>
              <p>聴き終わったらトピックカードで要点をチェック。採用するか見送るかをワンタップで整理。</p>
            </article>
          </div>
        </section>

        {/* --- Sample Episodes --- */}
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <p className={styles.eyebrow}>エピソード例</p>
            <h2>こんなエピソードが毎朝届きます</h2>
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
                    <dt>トピックカード</dt>
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
          </div>
          <div className={styles.membershipGrid}>
            <article className={styles.membershipCard}>
              <span className={styles.membershipTier}>無料</span>
              <h3>毎日聴いて情報をキャッチアップ</h3>
              <ul className={styles.membershipList}>
                <li>毎日のエピソード再生</li>
                <li>トピックカードのタイトルと概要</li>
                <li>好みの設定とおすすめの最適化</li>
              </ul>
            </article>
            <article className={styles.membershipCard}>
              <span className={styles.membershipTier}>有料</span>
              <h3>フルスクリプトと行動提案でもっと深く</h3>
              <ul className={styles.membershipList}>
                <li>エピソードのフルスクリプト</li>
                <li>トピックカードの行動提案とタイミング</li>
                <li>過去エピソードのアーカイブ</li>
                <li>傾向分析とAI相談</li>
              </ul>
            </article>
          </div>
        </section>

        {/* --- CTA Footer --- */}
        <section className={`${styles.section} ${styles.ctaSection}`.trim()}>
          <div className={styles.sectionHeader}>
            <p className={styles.eyebrow}>はじめよう</p>
            <h2>明日の通勤から、聴くだけインプット。</h2>
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
              ▶ {startLabel}
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
