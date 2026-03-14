import AnalyticsPageView from "@/app/components/AnalyticsPageView";
import TrackedLink from "@/app/components/TrackedLink";
import { loadDecisionDashboardCards } from "@/app/lib/decisions";
import { buildOnboardingPath } from "@/app/lib/onboarding";
import { getViewerFromCookies } from "@/app/lib/viewer";
import styles from "./home.module.css";

export const dynamic = "force-dynamic";

const JUDGMENT_LABELS = {
  use_now: "今すぐ見る",
  watch: "様子を見る",
  skip: "今回は見送る"
} as const;

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

const FALLBACK_SAMPLE = {
  topicTitle: "週末に入る前に、今のサブスクで見ておきたい1本",
  judgmentType: "use_now",
  genre: "ドラマ",
  summary: "話題作でも、今の気分と使える時間に合うかを先に整理してから選べます。",
  nextAction: "配信中の作品一覧から候補を3本まで絞る",
  deadline: "日曜 21:00 までに確認"
} as const;

export default async function HomePage() {
  const viewer = await getViewerFromCookies();
  const { cards } = await loadDecisionDashboardCards({
    isPaid: false,
    userId: viewer?.userId
  });
  const sampleCard = cards[0];
  const startHref = viewer ? (viewer.needsOnboarding ? buildOnboardingPath("/decisions") : "/decisions") : "/account";
  const onboardingHref = buildOnboardingPath("/decisions");
  const onboardingSource = viewer?.needsOnboarding ? "landing_first_run" : "landing_preferences";
  const sample = sampleCard
    ? {
        topicTitle: sampleCard.topic_title,
        judgmentType: sampleCard.judgment_type,
        genre: sampleCard.genre ?? "配信作品",
        summary: sampleCard.judgment_summary,
        nextAction: sampleCard.action_text ?? "気になったらエピソードを開いて詳しく確認",
        deadline: formatDeadline(sampleCard.deadline_at)
      }
    : FALLBACK_SAMPLE;

  return (
    <main className={styles.page}>
      <AnalyticsPageView page="/" pageEventName="landing_view" />

      <div className={styles.shell}>
        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>First-Time Home</p>
            <h1>配信作品とサブスクの迷いを、短い判断メモで整理するサービス。</h1>
            <p className={styles.lead}>
              何を見るか、いつ見るか、今は見送るかを一目で決めやすくし、あとから振り返って次の選び方にも
              つなげます。
            </p>

            <div className={styles.ctaRow}>
              <TrackedLink
                href={startHref}
                className={styles.primaryLink}
                eventName="landing_cta_click"
                eventProperties={{
                  page: "/",
                  source: "landing_primary",
                  destination: startHref
                }}
                additionalEvents={
                  viewer?.needsOnboarding
                    ? [
                        {
                          eventName: "onboarding_entry_click",
                          eventProperties: {
                            page: "/",
                            source: "landing_primary",
                            destination: onboardingHref
                          }
                        }
                      ]
                    : undefined
                }
              >
                はじめる
              </TrackedLink>
              <TrackedLink
                href={onboardingHref}
                className={styles.secondaryLink}
                eventName="landing_cta_click"
                eventProperties={{
                  page: "/",
                  source: "landing_preferences",
                  destination: onboardingHref
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
                  source: "landing_demo",
                  destination: "/decisions"
                }}
              >
                デモを見る
              </TrackedLink>
            </div>

            <div className={styles.stats}>
              <article className={styles.stat}>
                <span>今日のおすすめ</span>
                <strong>まず見る1件が分かる</strong>
              </article>
              <article className={styles.stat}>
                <span>あとで見る管理</span>
                <strong>迷った候補を残せる</strong>
              </article>
              <article className={styles.stat}>
                <span>振り返り</span>
                <strong>判断結果を次に活かせる</strong>
              </article>
            </div>
          </div>

          <aside className={styles.sampleCard}>
            <div className={styles.sampleHeader}>
              <span className={styles.sampleLabel}>判断メモのサンプル</span>
              <span className={styles.sampleBadge}>{JUDGMENT_LABELS[sample.judgmentType]}</span>
            </div>
            <h2>{sample.topicTitle}</h2>
            <p className={styles.sampleSummary}>{sample.summary}</p>
            <dl className={styles.sampleMeta}>
              <div>
                <dt>ジャンル</dt>
                <dd>{sample.genre}</dd>
              </div>
              <div>
                <dt>次の一手</dt>
                <dd>{sample.nextAction}</dd>
              </div>
              <div>
                <dt>見直しタイミング</dt>
                <dd>{sample.deadline}</dd>
              </div>
            </dl>
            <TrackedLink
              href="/decisions"
              className={styles.inlineLink}
              eventName="landing_cta_click"
              eventProperties={{
                page: "/",
                source: "landing_sample_card",
                destination: "/decisions"
              }}
            >
              実際の画面を見る
            </TrackedLink>
          </aside>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <p className={styles.eyebrow}>What You Can Do</p>
            <h2>初めてでも迷いにくい3つの入口</h2>
          </div>
          <div className={styles.featureGrid}>
            <article className={styles.featureCard}>
              <h3>何のサービスか分かる</h3>
              <p>配信作品やサブスクの判断を助けるためのサービスだと、ホームの一文とサンプルで把握できます。</p>
            </article>
            <article className={styles.featureCard}>
              <h3>何ができるか分かる</h3>
              <p>おすすめを見る、あとで見る候補を残す、結果を振り返るという使い方を最初に案内します。</p>
            </article>
            <article className={styles.featureCard}>
              <h3>何をすればいいか分かる</h3>
              <p>まずデモを見るか、好みを設定してからおすすめを見るかを、CTA から自然に選べます。</p>
            </article>
          </div>
        </section>
      </div>
    </main>
  );
}
