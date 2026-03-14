import AnalyticsPageView from "@/app/components/AnalyticsPageView";
import TrackedLink from "@/app/components/TrackedLink";
import { loadDecisionDashboardCards } from "@/app/lib/decisions";
import { buildOnboardingPath } from "@/app/lib/onboarding";
import { formatTopicTitle } from "@/app/lib/uiText";
import { getViewerFromCookies } from "@/app/lib/viewer";
import styles from "./home.module.css";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "今日見るもの、続けるもの、見送るものを決める。 | 視聴判断ガイド",
  description: "エンタメ視聴とサブスクの迷いを、AIと履歴で整理する。"
};

const JUDGMENT_LABELS = {
  use_now: "今日見る",
  watch: "様子を見る",
  skip: "見送る"
} as const;

const FALLBACK_SAMPLES = [
  {
    topicTitle: "週末に入る前に、今のサブスクで見ておきたい1本",
    judgmentType: "use_now",
    genre: "ドラマ",
    summary: "今の気分と使える時間に合う作品を先に絞ると、迷わず見始められます。",
    nextAction: "今夜見る候補を3本まで絞る",
    deadline: "日曜 21:00 までに確認"
  },
  {
    topicTitle: "続きものは今週のうちに続けるべきか",
    judgmentType: "watch",
    genre: "アニメ",
    summary: "話題だけで追いかけず、今のペースで続けられるかを先に判断できます。",
    nextAction: "次の1話だけ試して、続けるか決める",
    deadline: "次回配信前に見直す"
  },
  {
    topicTitle: "追加課金してまで見るか迷う作品",
    judgmentType: "skip",
    genre: "映画",
    summary: "今の予算や満足度の見込みを整理して、今回は見送る判断も残せます。",
    nextAction: "配信待ちリストに入れて後日確認",
    deadline: "来月の更新前に見直す"
  }
] as const;

const formatDeadline = (value: string | null): string => {
  if (!value) return "今週のうちに確認";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("ja-JP", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
};

const buildAccountEntryPath = (nextPath: string): string => {
  return `/account?next=${encodeURIComponent(nextPath)}`;
};

export default async function HomePage() {
  const viewer = await getViewerFromCookies();
  const { cards } = await loadDecisionDashboardCards({
    isPaid: viewer?.isPaid ?? false,
    userId: viewer?.userId
  });

  const onboardingHref = buildOnboardingPath("/decisions");
  const onboardingEntryHref = viewer ? onboardingHref : buildAccountEntryPath(onboardingHref);
  const startHref = onboardingEntryHref;
  const loginHref = buildAccountEntryPath(onboardingHref);
  const onboardingSource = viewer?.needsOnboarding ? "landing_first_run" : "landing_preferences";

  const samples =
    cards
      .filter((card) => card.genre !== "tech")
      .slice(0, 3)
      .map((card) => ({
      topicTitle: formatTopicTitle(card.topic_title),
      judgmentType: card.judgment_type,
      genre: card.genre ?? "配信作品",
      summary: card.judgment_summary,
      nextAction: card.action_text ?? "気になったら詳細を開いて確認",
      deadline: formatDeadline(card.deadline_at)
    })) || [];

  const visibleSamples = samples.length > 0 ? samples : FALLBACK_SAMPLES;
  const heroSample = visibleSamples[0];

  return (
    <main className={styles.page}>
      <AnalyticsPageView page="/" pageEventName="landing_view" />

      <div className={styles.shell}>
        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>ホーム</p>
            <h1>今日見るもの、続けるもの、見送るものを決める。</h1>
            <p className={styles.subcopy}>エンタメ視聴とサブスクの迷いを、AIと履歴で整理する。</p>
            <p className={styles.lead}>
              AIが、あなたの好みや過去の判断をもとに、今日のおすすめ判断を提案します。
              迷った判断を保存し、結果を振り返り、次の判断をより良くできます。
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
                additionalEvents={
                  [
                    {
                      eventName: "landing_cta_click",
                      eventProperties: {
                        page: "/",
                        source: "landing_primary",
                        destination: startHref
                      }
                    },
                    {
                      eventName: "onboarding_entry_click",
                      eventProperties: {
                        page: "/",
                        source: "landing_primary",
                        destination: onboardingHref
                      }
                    }
                  ]
                }
              >
                はじめる
              </TrackedLink>
              <TrackedLink
                href={onboardingEntryHref}
                className={styles.secondaryLink}
                eventName="landing_cta_click"
                eventProperties={{
                  page: "/",
                  source: "landing_preferences",
                  destination: onboardingEntryHref
                }}
                additionalEvents={[
                  {
                    eventName: "onboarding_entry_click",
                    eventProperties: {
                      page: "/",
                      source: onboardingSource,
                      destination: onboardingHref
                    }
                  }
                ]}
              >
                好みを設定する
              </TrackedLink>
              <TrackedLink
                href="/decisions"
                className={styles.ghostLink}
                eventName="landing_cta_click"
                eventProperties={{
                  page: "/",
                  source: "landing_decisions",
                  destination: "/decisions"
                }}
              >
                判断を見る
              </TrackedLink>
            </div>

            <div className={styles.stats}>
              <article className={styles.stat}>
                <span>今日のおすすめ判断</span>
                <strong>まず何を見るかがすぐ分かる</strong>
              </article>
              <article className={styles.stat}>
                <span>あとで見返す判断</span>
                <strong>迷った候補を残して整理できる</strong>
              </article>
              <article className={styles.stat}>
                <span>振り返り</span>
                <strong>結果を次の判断に活かせる</strong>
              </article>
            </div>
          </div>

          <aside className={styles.sampleCard}>
            <div className={styles.sampleHeader}>
              <span className={styles.sampleLabel}>今日の判断例</span>
              <span className={styles.sampleBadge}>{JUDGMENT_LABELS[heroSample.judgmentType]}</span>
            </div>
            <h2>{heroSample.topicTitle}</h2>
            <p className={styles.sampleSummary}>{heroSample.summary}</p>
            <dl className={styles.sampleMeta}>
              <div>
                <dt>ジャンル</dt>
                <dd>{heroSample.genre}</dd>
              </div>
              <div>
                <dt>次にするとよいこと</dt>
                <dd>{heroSample.nextAction}</dd>
              </div>
              <div>
                <dt>見直しタイミング</dt>
                <dd>{heroSample.deadline}</dd>
              </div>
            </dl>
          </aside>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <p className={styles.eyebrow}>できること</p>
            <h2>最初に分かる3つのこと</h2>
          </div>
          <div className={styles.featureGrid}>
            <article className={styles.featureCard}>
              <h3>今日のおすすめ判断が分かる</h3>
              <p>今日見るもの、続けるか見極めるもの、見送るものを、短く分かりやすく提案します。</p>
            </article>
            <article className={styles.featureCard}>
              <h3>迷った判断を保存できる</h3>
              <p>その場で決めきれない候補は残しておき、あとから見直して判断を続けられます。</p>
            </article>
            <article className={styles.featureCard}>
              <h3>結果を振り返って次に活かせる</h3>
              <p>保存した判断の結果を残すことで、次のおすすめが少しずつあなた向けに整います。</p>
            </article>
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <p className={styles.eyebrow}>判断カードのサンプル</p>
            <h2>こういう判断が表示されます</h2>
            <p className={styles.sectionLead}>今日すぐ見る候補だけでなく、少し様子を見る判断や見送る判断も並びます。</p>
          </div>
          <div className={styles.sampleGrid}>
            {visibleSamples.map((sample, index) => (
              <article key={`${sample.topicTitle}-${index}`} className={styles.samplePanel}>
                <div className={styles.samplePanelHeader}>
                  <span className={styles.samplePanelBadge}>{JUDGMENT_LABELS[sample.judgmentType]}</span>
                  <span className={styles.samplePanelGenre}>{sample.genre}</span>
                </div>
                <h3>{sample.topicTitle}</h3>
                <p>{sample.summary}</p>
                <dl className={styles.samplePanelMeta}>
                  <div>
                    <dt>次にするとよいこと</dt>
                    <dd>{sample.nextAction}</dd>
                  </div>
                  <div>
                    <dt>見直しタイミング</dt>
                    <dd>{sample.deadline}</dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <p className={styles.eyebrow}>使い方</p>
            <h2>はじめ方は3ステップです</h2>
          </div>
          <ol className={styles.stepList}>
            <li className={styles.stepCard}>
              <strong>1. 好みを設定する</strong>
              <p>よく見るジャンルや使っているサービスを入れて、今日のおすすめを整えます。</p>
            </li>
            <li className={styles.stepCard}>
              <strong>2. 今日の判断を見る</strong>
              <p>AIが出した判断を見て、今日見るか、続けるか、見送るかを決めます。</p>
            </li>
            <li className={styles.stepCard}>
              <strong>3. 保存して振り返る</strong>
              <p>迷った判断や結果を残して、次に同じように迷ったときの判断材料にします。</p>
            </li>
          </ol>
        </section>

        <section className={`${styles.section} ${styles.ctaSection}`.trim()}>
          <div className={styles.sectionHeader}>
            <p className={styles.eyebrow}>次にすること</p>
            <h2>まず何をすればいいか、ここから選べます</h2>
            <p className={styles.sectionLead}>初めてなら好み設定から、すぐ試したいなら判断一覧から始められます。</p>
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
              additionalEvents={[
                {
                  eventName: "landing_cta_click",
                  eventProperties: {
                    page: "/",
                    source: "landing_footer_primary",
                    destination: startHref
                  }
                },
                {
                  eventName: "onboarding_entry_click",
                  eventProperties: {
                    page: "/",
                    source: "landing_footer_primary",
                    destination: onboardingHref
                  }
                }
              ]}
            >
              はじめる
            </TrackedLink>
            <TrackedLink
              href={loginHref}
              className={styles.secondaryLink}
              eventName="landing_cta_click"
              eventProperties={{
                page: "/",
                source: "landing_footer_login",
                destination: loginHref
              }}
            >
              ログイン
            </TrackedLink>
            <TrackedLink
              href="/decisions"
              className={styles.ghostLink}
              eventName="landing_cta_click"
              eventProperties={{
                page: "/",
                source: "landing_footer_decisions",
                destination: "/decisions"
              }}
            >
              すでに利用中なら今日の判断へ
            </TrackedLink>
          </div>
        </section>
      </div>
    </main>
  );
}
