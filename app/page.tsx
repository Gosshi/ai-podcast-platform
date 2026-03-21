import AnalyticsPageView from "@/app/components/AnalyticsPageView";
import TrackedLink from "@/app/components/TrackedLink";
import { buildLoginPath, buildOnboardingPath } from "@/app/lib/onboarding";
import { getViewerFromCookies } from "@/app/lib/viewer";
import { BRAND_NAME, SITE_NAME } from "@/src/lib/brand";
import { MONTHLY_PRICE_YEN, resolveSubscriptionTrialLabel } from "@/src/lib/subscriptionPlan";
import styles from "./home.module.css";

export const dynamic = "force-dynamic";
export const metadata = {
  title: `聴くだけで、今日やるか見送るかが決まる | ${SITE_NAME}`,
  description:
    "AIポッドキャストと判断カードで、サブスク・買い物・AIツールの迷いを毎朝整理。聴いたあとに次の行動まで決められる。"
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
  const trialLabel = resolveSubscriptionTrialLabel();

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
            <p className={styles.eyebrow}>{BRAND_NAME}</p>
            <h1>聴くだけで、今日やるか見送るかが決まる。</h1>
            <p className={styles.lead}>
              AI が毎朝エピソードを生成し、サブスク・買い物・AIツールの迷いを整理。
              聴いたあとに判断カードで、やる・様子見・見送りまでそのまま決められます。
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
                <span>判断支援</span>
                <strong>迷いを「やる・様子見・見送り」に分ける</strong>
              </article>
              <article className={styles.stat}>
                <span>毎日更新</span>
                <strong>毎朝のエピソードで意思決定を先回り</strong>
              </article>
              <article className={styles.stat}>
                <span>次の一手</span>
                <strong>聴いた内容をそのまま行動に変える</strong>
              </article>
            </div>
          </div>

          <aside className={styles.sampleCard}>
            <div className={styles.sampleHeader}>
              <span className={styles.sampleLabel}>Now Playing</span>
              <span className={styles.sampleBadge}>8分</span>
            </div>
            <h2>今月見直すべきサブスク3つ</h2>
            <p className={styles.sampleSummary}>
              利用頻度、代替手段、来月の支出を見ながら、残す・止める・あとで見直すを整理します。
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
                <dd>マネー / サブスク</dd>
              </div>
              <div>
                <dt>判断カード</dt>
                <dd>解約・継続・保留の3件</dd>
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
              <p>関心のあるテーマを選ぶだけ。毎朝のエピソードが、あなた向けの判断トピックに寄ります。</p>
            </article>
            <article className={styles.featureCard}>
              <h3>2. 通勤中にイヤホンで聴く</h3>
              <p>5〜10分で背景と論点を把握。読む時間を使わず、判断に必要な材料だけ先に入ります。</p>
            </article>
            <article className={styles.featureCard}>
              <h3>3. カードでポイントを確認</h3>
              <p>聴いたあとに判断カードを確認。やる・様子見・見送りと次の一手をその場で決められます。</p>
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
              <div className={styles.membershipPrice}>
                <span>¥0</span>
              </div>
              <h3>毎日聴いて、迷いを整理する</h3>
              <ul className={styles.membershipList}>
                <li>毎日のエピソード再生</li>
                <li>トピックカードのタイトルと概要</li>
                <li>好みの設定とおすすめの最適化</li>
              </ul>
            </article>
            <article className={`${styles.membershipCard} ${styles.membershipCardHighlighted}`}>
              <div className={styles.membershipBadgeRow}>
                <span className={styles.membershipTier}>有料</span>
                <span className={styles.membershipRecommendBadge}>おすすめ</span>
              </div>
              <div className={styles.membershipPrice}>
                <span>月額 ¥{MONTHLY_PRICE_YEN}</span>
                <span className={styles.membershipPriceSuffix}>/ 月</span>
              </div>
              <p className={styles.membershipPriceTax}>(税込)</p>
              {trialLabel ? <span className={styles.membershipTrialBadge}>{trialLabel}</span> : null}
              <h3>行動提案と振り返りで、判断を積み上げる</h3>
              <ul className={styles.membershipList}>
                <li>エピソードのフルスクリプト</li>
                <li>トピックカードの行動提案とタイミング</li>
                <li>過去エピソードのアーカイブ</li>
                <li>傾向分析とAI相談</li>
              </ul>
              <TrackedLink
                href="/login?next=/account"
                className={styles.membershipCta}
                eventName="landing_cta_click"
                eventProperties={{
                  page: "/",
                  source: "landing_pricing",
                  destination: "/login?next=/account"
                }}
              >
                有料版をはじめる
              </TrackedLink>
            </article>
          </div>
        </section>

        {/* --- CTA Footer --- */}
        <section className={`${styles.section} ${styles.ctaSection}`.trim()}>
          <div className={styles.sectionHeader}>
            <p className={styles.eyebrow}>はじめよう</p>
            <h2>明日の通勤から、判断の先送りを減らす。</h2>
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
