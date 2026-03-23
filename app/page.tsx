import AnalyticsPageView from "@/app/components/AnalyticsPageView";
import TrackedLink from "@/app/components/TrackedLink";
import { loadPublishedEpisodes } from "@/app/lib/episodes";
import { buildLoginPath, buildOnboardingPath } from "@/app/lib/onboarding";
import { getViewerFromCookies } from "@/app/lib/viewer";
import { BRAND_NAME, SITE_NAME } from "@/src/lib/brand";
import { buildPublicEpisodePath } from "@/src/lib/episodeLinks";
import {
  APPLE_PODCASTS_SHOW_URL,
  PUBLIC_EPISODES_URL,
  SPOTIFY_SHOW_URL,
  X_PROFILE_URL
} from "@/src/lib/publicLinks";
import { MONTHLY_PRICE_YEN, resolveSubscriptionTrialLabel } from "@/src/lib/subscriptionPlan";
import styles from "./home.module.css";

export const dynamic = "force-dynamic";
export const metadata = {
  title: `聴くだけで、今日やるか見送るかが決まる | ${SITE_NAME}`,
  description:
    "毎朝のAIエピソードと判断カードで、サブスク・買い物・AIツールの迷いを整理。聴いたあとに、やる・様子見・見送りと次の一手まで決められる。"
};

const SAMPLE_EPISODES = [
  {
    title: "動画サブスク、今月1つ止めるならどれ？",
    genre: "固定費",
    duration: "7分",
    cards: 3,
    summary: "利用頻度と代替手段を比べて、残す・解約する・保留を切り分けます。"
  },
  {
    title: "新しいAIツール、今週試す価値ある？",
    genre: "AIツール",
    duration: "6分",
    cards: 2,
    summary: "料金、時短効果、乗り換えコストから、今試すか見送るかを整理します。"
  },
  {
    title: "話題の記事、読む時間を使うべき？",
    genre: "情報収集",
    duration: "5分",
    cards: 3,
    summary: "今読む理由、後回しでいい理由、スルーでいい理由を分けて確認します。"
  }
] as const;

export default async function HomePage() {
  const viewer = await getViewerFromCookies();
  const trialLabel = resolveSubscriptionTrialLabel();
  const { episodes } = await loadPublishedEpisodes({
    genreFilter: null,
    isPaid: viewer?.isPaid ?? false,
    userId: viewer?.userId ?? null
  });
  const featuredEpisode =
    episodes.find((episode) => episode.lang === "ja") ?? episodes[0] ?? null;
  const featuredEpisodeHref = featuredEpisode
    ? buildPublicEpisodePath(featuredEpisode.id)
    : "/episodes";
  const featuredEpisodeSummary =
    featuredEpisode?.description?.trim() ||
    featuredEpisode?.preview_text?.trim() ||
    "公開エピソードから、その日の判断ポイントをすぐに確認できます。";

  const onboardingHref = buildOnboardingPath("/decisions");
  const loginHref = buildLoginPath("/decisions");
  const startHref = viewer ? "/decisions" : loginHref;
  const startLabel = viewer ? "今日のエピソードを聴く" : "無料ではじめる";
  const secondaryHref = viewer ? onboardingHref : featuredEpisodeHref;
  const secondaryLabel = viewer ? "好みを設定する" : "公開回を聴く";

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
              毎朝の AI エピソードが、サブスク・買い物・AIツールの迷いを先に整理します。
              聴いた直後に判断カードと次の一手が返るので、
              やる・様子見・見送りまでその場で決められます。
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

            {!viewer ? (
              <div className={styles.microActions}>
                <TrackedLink
                  href={loginHref}
                  className={styles.inlineLink}
                  eventName="landing_cta_click"
                  eventProperties={{
                    page: "/",
                    source: "landing_login_link",
                    destination: loginHref
                  }}
                >
                  すでにアカウントがある方はこちら
                </TrackedLink>
              </div>
            ) : null}

            <div className={styles.listenRow}>
              <span className={styles.listenLabel}>今すぐ聴く</span>
              <TrackedLink
                href={APPLE_PODCASTS_SHOW_URL}
                className={styles.listenChip}
                eventName="landing_cta_click"
                eventProperties={{
                  page: "/",
                  source: "landing_listen_row",
                  destination: APPLE_PODCASTS_SHOW_URL,
                  channel: "apple_podcasts"
                }}
                target="_blank"
                rel="noreferrer"
              >
                Apple Podcasts
              </TrackedLink>
              <TrackedLink
                href={SPOTIFY_SHOW_URL}
                className={styles.listenChip}
                eventName="landing_cta_click"
                eventProperties={{
                  page: "/",
                  source: "landing_listen_row",
                  destination: SPOTIFY_SHOW_URL,
                  channel: "spotify"
                }}
                target="_blank"
                rel="noreferrer"
              >
                Spotify
              </TrackedLink>
              <TrackedLink
                href={PUBLIC_EPISODES_URL}
                className={styles.listenChip}
                eventName="landing_cta_click"
                eventProperties={{
                  page: "/",
                  source: "landing_listen_row",
                  destination: PUBLIC_EPISODES_URL,
                  channel: "web"
                }}
              >
                Webで聴く
              </TrackedLink>
              <TrackedLink
                href={X_PROFILE_URL}
                className={styles.listenChip}
                eventName="landing_cta_click"
                eventProperties={{
                  page: "/",
                  source: "landing_listen_row",
                  destination: X_PROFILE_URL,
                  channel: "x"
                }}
                target="_blank"
                rel="noreferrer"
              >
                Xで更新を見る
              </TrackedLink>
            </div>

            <div className={styles.stats}>
              <article className={styles.stat}>
                <span>5〜10分</span>
                <strong>通勤中に、迷いの論点だけ先に拾える</strong>
              </article>
              <article className={styles.stat}>
                <span>判断カード</span>
                <strong>やる・様子見・見送りをその場で決める</strong>
              </article>
              <article className={styles.stat}>
                <span>積み上げ</span>
                <strong>履歴と振り返りで、同じ迷いを減らしていく</strong>
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
            <h2>迷いを判断に変える、3ステップ</h2>
          </div>
          <div className={styles.featureGrid}>
            <article className={styles.featureCard}>
              <h3>1. 好みを30秒で設定</h3>
              <p>関心のあるテーマを選ぶだけ。毎朝のエピソードが、あなた向けの判断トピックに寄っていきます。</p>
            </article>
            <article className={styles.featureCard}>
              <h3>2. 通勤中に論点だけ聴く</h3>
              <p>5〜10分で背景と比較軸を把握。読む時間を使わず、判断に必要な材料だけ先に入ります。</p>
            </article>
            <article className={styles.featureCard}>
              <h3>3. カードと履歴で決める</h3>
              <p>聴いたあとに判断カードを確認。やる・様子見・見送りと次の一手を決め、あとで振り返れます。</p>
            </article>
          </div>
        </section>

        {/* --- Sample Episodes --- */}
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <p className={styles.eyebrow}>向いている迷い</p>
            <h2>こんなテーマを、毎朝の判断材料に変えます</h2>
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
                    <dd>{episode.cards}件の判断ポイント</dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
        </section>

        <section className={`${styles.section} ${styles.discoverySection}`.trim()}>
          <div className={styles.sectionHeader}>
            <p className={styles.eyebrow}>公開中</p>
            <h2>まずは公開回を1本聴いて、合うかどうかを確かめる</h2>
          </div>
          <div className={styles.discoveryGrid}>
            <article className={styles.discoveryCard}>
              <span className={styles.discoveryLabel}>最新の公開回</span>
              <h3>{featuredEpisode?.title ?? "公開エピソード一覧"}</h3>
              <p>{featuredEpisodeSummary}</p>
              <div className={styles.discoveryActions}>
                <TrackedLink
                  href={featuredEpisodeHref}
                  className={styles.primaryLink}
                  eventName="landing_cta_click"
                  eventProperties={{
                    page: "/",
                    source: "landing_featured_episode",
                    destination: featuredEpisodeHref
                  }}
                >
                  公開回を聴く
                </TrackedLink>
                <TrackedLink
                  href="/episodes"
                  className={styles.secondaryLink}
                  eventName="landing_cta_click"
                  eventProperties={{
                    page: "/",
                    source: "landing_episode_index",
                    destination: "/episodes"
                  }}
                >
                  すべての公開回を見る
                </TrackedLink>
              </div>
            </article>
            <article className={styles.discoveryCardMuted}>
              <span className={styles.discoveryLabel}>入口</span>
              <h3>アプリ内でも、外部配信でも、同じ公開回に入れる</h3>
              <ul className={styles.discoveryList}>
                <li>Apple Podcasts と Spotify でそのまま再生できる</li>
                <li>Web では公開回から無料登録と有料開始までつながる</li>
                <li>X では新着公開回と更新情報を追える</li>
              </ul>
            </article>
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <p className={styles.eyebrow}>有料版</p>
            <h2>有料版で増えるのは、情報量より判断の深さです</h2>
          </div>
          <div className={styles.featureGrid}>
            <article className={styles.featureCard}>
              <h3>行動提案まで見える</h3>
              <p>判断カードの全文、次の一手、見直しタイミングまで確認できます。</p>
            </article>
            <article className={styles.featureCard}>
              <h3>履歴から学べる</h3>
              <p>保存した判断と結果を振り返り、どの判断パターンが合っていたかを見直せます。</p>
            </article>
            <article className={styles.featureCard}>
              <h3>見直し漏れを防げる</h3>
              <p>期限が近い判断や週次まとめを inbox で受け取り、迷いを放置しにくくします。</p>
            </article>
          </div>
        </section>

        {/* --- Membership --- */}
        <section className={`${styles.section} ${styles.membershipSection}`.trim()}>
          <div className={styles.sectionHeader}>
            <p className={styles.eyebrow}>プラン</p>
            <h2>無料で試せる。有料で判断を積み上げる。</h2>
          </div>
          <div className={styles.membershipGrid}>
            <article className={styles.membershipCard}>
              <span className={styles.membershipTier}>無料</span>
              <div className={styles.membershipPrice}>
                <span>¥0</span>
              </div>
              <h3>毎日聴いて、迷いを軽くする</h3>
              <ul className={styles.membershipList}>
                <li>毎日のエピソード再生</li>
                <li>最新プレビューと判断カード概要</li>
                <li>好み設定とおすすめの調整</li>
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
                <li>フルスクリプトと過去エピソードのアーカイブ</li>
                <li>判断カードの行動提案と見直しタイミング</li>
                <li>履歴の振り返りとインサイト</li>
                <li>お知らせ inbox と AI 相談</li>
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
            <h2>明日の通勤から、判断の後回しを減らす。</h2>
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
