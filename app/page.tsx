import AnalyticsPageView from "@/app/components/AnalyticsPageView";
import TrackedLink from "@/app/components/TrackedLink";
import { loadDecisionDashboardCards } from "@/app/lib/decisions";
import { buildLoginPath, buildOnboardingPath } from "@/app/lib/onboarding";
import { formatGenreLabel, formatTopicTitle } from "@/app/lib/uiText";
import { getViewerFromCookies } from "@/app/lib/viewer";
import styles from "./home.module.css";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "日々の判断をAIと履歴で整理する | AI Decision Assistant",
  description: "今日何を見るか、何を試すか、何を見送るかを短い判断カードで整理する。"
};

const JUDGMENT_LABELS = {
  use_now: "採用",
  watch: "後で考える",
  skip: "見送る"
} as const;

const FALLBACK_HERO_SAMPLES = [
  {
    topicTitle: "今夜は新しいドラマを1話だけ試す",
    judgmentType: "use_now",
    genre: "エンタメ",
    summary: "平日の残り時間で最後まで見切れる長さに絞ると、迷いが減ります。",
    nextAction: "候補を1本だけ開く",
    deadline: "今夜 21:00 に見直す"
  },
  {
    topicTitle: "今のサブスクは今月もう1か月続ける",
    judgmentType: "watch",
    genre: "サブスク",
    summary: "今週使う予定があるなら、先に使い切ってから解約判断したほうが後悔しにくくなります。",
    nextAction: "今週使った回数を数える",
    deadline: "3日後に見直す"
  },
  {
    topicTitle: "AIノート環境は今週1つだけ試す",
    judgmentType: "watch",
    genre: "ツール",
    summary: "今の制限で作業が遅いなら、全面移行ではなく1つ試す判断が現実的です。",
    nextAction: "候補を1つだけ試す",
    deadline: "3日後に見直す"
  }
] as const;

const SHOWCASE_SAMPLES = [
  {
    topicTitle: "今夜は新しいドラマを1話だけ試す",
    judgmentType: "use_now",
    genre: "エンタメ",
    summary: "気分と使える時間に合う候補から始めると、迷わず動けます。",
    nextAction: "候補を1本だけ開く",
    deadline: "今夜 21:00 に見直す"
  },
  {
    topicTitle: "今のサブスクは今月もう1か月続ける",
    judgmentType: "watch",
    genre: "サブスク",
    summary: "利用頻度を確認してから更新判断すると、無駄な継続を減らせます。",
    nextAction: "今週使った回数を数える",
    deadline: "3日後に見直す"
  },
  {
    topicTitle: "AIノート環境は今週1つだけ試す",
    judgmentType: "watch",
    genre: "ツール",
    summary: "全面移行ではなく1つ試すと、判断コストを抑えながら比較できます。",
    nextAction: "候補を1つだけ試す",
    deadline: "3日後に見直す"
  },
  {
    topicTitle: "明日の朝にやることは1つに絞る",
    judgmentType: "skip",
    genre: "生活",
    summary: "優先順位が曖昧なままだと着手が遅れるので、最初の1つだけを決めます。",
    nextAction: "朝一で着手する1件を決める",
    deadline: "明日 08:00 に見直す"
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

export default async function HomePage() {
  const viewer = await getViewerFromCookies();
  const { cards } = await loadDecisionDashboardCards({
    isPaid: viewer?.isPaid ?? false,
    userId: viewer?.userId
  });

  const onboardingHref = buildOnboardingPath("/decisions");
  const loginHref = buildLoginPath("/decisions");
  const startHref = viewer ? onboardingHref : loginHref;
  const startLabel = viewer ? "好みを見直す" : "はじめる";
  const decisionsHref = viewer ? "/decisions" : loginHref;
  const decisionsLabel = viewer ? "今日のおすすめを見る" : "ログインして今日のおすすめを見る";
  const accountHref = viewer ? "/account" : loginHref;
  const accountLabel = viewer ? "アカウントを見る" : "ログイン";

  const samples =
    cards
      .slice(0, 1)
      .map((card) => ({
      topicTitle: formatTopicTitle(card.topic_title),
      judgmentType: card.judgment_type,
      genre: formatGenreLabel(card.genre, "カテゴリ未設定"),
      summary: card.judgment_summary,
      nextAction: card.action_text ?? "気になったら詳細を開いて確認",
      deadline: formatDeadline(card.deadline_at)
    })) || [];

  const heroSample = samples[0] ?? FALLBACK_HERO_SAMPLES[0];

  return (
    <main className={styles.page}>
      <AnalyticsPageView page="/" pageEventName="landing_view" />

      <div className={styles.shell}>
        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>ホーム</p>
            <h1>日々の判断をAIと履歴で整理する。</h1>
            <p className={styles.subcopy}>AI Decision Assistant</p>
            <p className={styles.lead}>
              今日何を選ぶか、サブスクを続けるか、ツールを試すか、何を先にやるか。
              AIが短い判断カードで整理し、行動、結果、学習のループを支えます。
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
                {startLabel}
              </TrackedLink>
              <TrackedLink
                href={decisionsHref}
                className={styles.secondaryLink}
                eventName="landing_cta_click"
                eventProperties={{
                  page: "/",
                  source: "landing_decisions",
                  destination: decisionsHref
                }}
              >
                {decisionsLabel}
              </TrackedLink>
            </div>

            <div className={styles.mobileHeroPreview}>
              <div className={styles.mobileHeroPreviewHeader}>
                <span className={styles.mobileHeroPreviewLabel}>こんな判断が届きます</span>
                <span className={styles.mobileHeroPreviewBadge}>{JUDGMENT_LABELS[heroSample.judgmentType]}</span>
              </div>
              <strong className={styles.mobileHeroPreviewTitle}>{heroSample.topicTitle}</strong>
              <p className={styles.mobileHeroPreviewSummary}>{heroSample.summary}</p>
              <div className={styles.mobileHeroPreviewMeta}>
                <span>{heroSample.genre}</span>
                <span>{heroSample.nextAction}</span>
              </div>
            </div>

            <div className={styles.stats}>
              <article className={styles.stat}>
                <span>短い判断カード</span>
                <strong>まず1つ決めて動ける</strong>
              </article>
              <article className={styles.stat}>
                <span>保存</span>
                <strong>後で考える判断を残せる</strong>
              </article>
              <article className={styles.stat}>
                <span>結果</span>
                <strong>満足 / 普通 / 後悔を次に活かせる</strong>
              </article>
            </div>
          </div>

          <aside className={styles.sampleCard}>
            <div className={styles.sampleHeader}>
              <span className={styles.sampleLabel}>おすすめカード</span>
              <span className={styles.sampleBadge}>{JUDGMENT_LABELS[heroSample.judgmentType]}</span>
            </div>
            <h2>{heroSample.topicTitle}</h2>
            <p className={styles.sampleSummary}>{heroSample.summary}</p>
            <dl className={styles.sampleMeta}>
              <div>
                <dt>カテゴリ</dt>
                <dd>{heroSample.genre}</dd>
              </div>
              <div>
                <dt>次の行動</dt>
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
            <h2>判断を前に進める3つの流れ</h2>
          </div>
          <div className={styles.featureGrid}>
            <article className={styles.featureCard}>
              <h3>判断を短く整理する</h3>
              <p>理由、次の行動、見直しタイミングまで含めて、迷いを短いカードにまとめます。</p>
            </article>
            <article className={styles.featureCard}>
              <h3>行動に変える</h3>
              <p>カードを見たあとに何をするかが決まるので、考えたまま止まりにくくなります。</p>
            </article>
            <article className={styles.featureCard}>
              <h3>結果から学ぶ</h3>
              <p>実行後の満足、普通、後悔を残すことで、次のおすすめが少しずつ自分向けになります。</p>
            </article>
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <p className={styles.eyebrow}>判断カードのサンプル</p>
            <h2>こういう判断が表示されます</h2>
            <p className={styles.sectionLead}>動画だけではなく、サブスク、ツール、生活判断まで同じ形で整理します。</p>
          </div>
          <div className={styles.sampleGrid}>
            {SHOWCASE_SAMPLES.map((sample, index) => (
              <article key={`${sample.topicTitle}-${index}`} className={styles.samplePanel}>
                <div className={styles.samplePanelHeader}>
                  <span className={styles.samplePanelBadge}>{JUDGMENT_LABELS[sample.judgmentType]}</span>
                  <span className={styles.samplePanelGenre}>{sample.genre}</span>
                </div>
                <h3>{sample.topicTitle}</h3>
                <p>{sample.summary}</p>
                <dl className={styles.samplePanelMeta}>
                  <div>
                    <dt>次の行動</dt>
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
              <strong>1. まず1枚の判断を見る</strong>
              <p>最初におすすめカードを見て、このアプリがどんな判断を返すかを体験します。</p>
            </li>
            <li className={styles.stepCard}>
              <strong>2. ログインして好みを整える</strong>
              <p>よく使うサービスや重視することを入れて、おすすめを自分向けにします。</p>
            </li>
            <li className={styles.stepCard}>
              <strong>3. 行動して結果を残す</strong>
              <p>保存や採用、結果の記録を繰り返して、判断の精度を上げていきます。</p>
            </li>
          </ol>
        </section>

        <section className={`${styles.section} ${styles.ctaSection}`.trim()}>
          <div className={styles.sectionHeader}>
            <p className={styles.eyebrow}>次にすること</p>
            <h2>まず何をすればいいか、ここから選べます</h2>
            <p className={styles.sectionLead}>
              {viewer
                ? "必要なら好みを見直し、そのまま今日のおすすめやアカウント確認へ進めます。"
                : "初回はログインしておすすめを整え、慣れていればそのまま今日のおすすめへ進めます。"}
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
              {startLabel}
            </TrackedLink>
            <TrackedLink
              href={accountHref}
              className={styles.secondaryLink}
              eventName="landing_cta_click"
              eventProperties={{
                page: "/",
                source: viewer ? "landing_footer_account" : "landing_footer_login",
                destination: accountHref
              }}
              >
                {accountLabel}
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
                すでに利用中なら今日のおすすめへ
              </TrackedLink>
            </div>
          </section>
      </div>
    </main>
  );
}
