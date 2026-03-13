import Link from "next/link";
import MemberControls from "@/app/components/MemberControls";
import SaveDecisionButton from "@/app/components/SaveDecisionButton";
import { loadDecisionHistory } from "@/app/lib/decisionHistory";
import { formatThresholdHighlights } from "@/app/lib/judgmentAccess";
import { loadDecisionDashboardCards } from "@/app/lib/decisions";
import { buildPersonalDecisionHint } from "@/src/lib/decisionProfile";
import { getViewerFromCookies } from "@/app/lib/viewer";
import { groupDecisionDashboardCards, pickTodayDecisionCards } from "@/src/lib/decisionDashboard";
import { rankNextBestDecisions } from "@/src/lib/nextBestDecision";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

const JUDGMENT_TYPE_LABELS = {
  use_now: "使う",
  watch: "監視",
  skip: "見送り"
} as const;

const JUDGMENT_TYPE_DESCRIPTIONS = {
  use_now: "今日すぐ使う候補",
  watch: "条件変化を監視する候補",
  skip: "今は見送る候補"
} as const;

const URGENCY_LEVEL_LABELS = {
  critical: "最優先",
  high: "高優先",
  medium: "確認",
  low: "低優先"
} as const;

const formatDeadline = (value: string | null): string => {
  if (!value) return "期限未設定";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("ja-JP", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
};

const formatDecisionDate = (value: string | null): string => {
  if (!value) return "公開日未設定";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric"
  });
};

export default async function DecisionsPage() {
  const viewer = await getViewerFromCookies();
  const isPaid = viewer?.isPaid ?? false;
  const { cards, error } = await loadDecisionDashboardCards({ isPaid, userId: viewer?.userId });
  const personalProfile = viewer?.isPaid && viewer?.userId ? (await loadDecisionHistory(viewer.userId)).profile : null;
  const nextBestDecisions = rankNextBestDecisions({
    cards,
    isPaid,
    profile: personalProfile
  });
  const todayCards = pickTodayDecisionCards(cards);
  const groupedCards = groupDecisionDashboardCards(cards);
  const todayLabel = formatDecisionDate(todayCards[0]?.episode_published_at ?? null);
  const renderDecisionCard = (
    card: (typeof cards)[number],
    secondaryMetaLabel: string,
    secondaryMetaValue: string
  ) => {
    const personalHint = isPaid && personalProfile ? buildPersonalDecisionHint({ card, profile: personalProfile }) : null;

    return (
      <article key={card.id} className={styles.card}>
        <Link href={`/episodes/${card.episode_id}`} className={styles.cardLink}>
          <div className={styles.cardHeader}>
            <span className={`${styles.badge} ${styles[`badge_${card.judgment_type}`]}`.trim()}>
              {JUDGMENT_TYPE_LABELS[card.judgment_type]}
            </span>
            <span className={styles.genreTag}>{card.genre ?? "general"}</span>
          </div>
          <h3>{card.topic_title}</h3>
          <p className={styles.summary}>{card.judgment_summary}</p>
          {personalHint ? (
            <div className={`${styles.personalHint} ${styles[`personalHint_${personalHint.tone}`]}`.trim()}>
              <span className={styles.personalHintLabel}>あなた向け補正</span>
              <p>{personalHint.text}</p>
            </div>
          ) : null}
          <dl className={styles.metaList}>
            {isPaid && card.action_text ? (
              <div>
                <dt>次の行動</dt>
                <dd>{card.action_text}</dd>
              </div>
            ) : null}
            {isPaid && card.deadline_at ? (
              <div>
                <dt>期限</dt>
                <dd>{formatDeadline(card.deadline_at)}</dd>
              </div>
            ) : null}
            <div>
              <dt>{secondaryMetaLabel}</dt>
              <dd>{secondaryMetaValue}</dd>
            </div>
          </dl>
          {isPaid && card.watch_points.length > 0 ? (
            <ul className={styles.detailList}>
              {card.watch_points.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          ) : null}
          {isPaid && formatThresholdHighlights(card.threshold_json).length > 0 ? (
            <ul className={styles.detailList}>
              {formatThresholdHighlights(card.threshold_json).map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : null}
          {!isPaid ? (
            <div className={styles.lockedPanel}>
              <strong>この先は有料会員向け</strong>
              <p>次の行動、期限、監視ポイント、判断基準を開放します。</p>
            </div>
          ) : null}
        </Link>
        <div className={styles.cardActionRow}>
          <SaveDecisionButton
            judgmentCardId={card.id}
            viewer={viewer}
            initialSaved={card.is_saved}
          />
        </div>
      </article>
    );
  };

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>Decision Dashboard</p>
          <h1>毎日見るべき入口を、エピソードではなく判断に切り替える。</h1>
          <p className={styles.lead}>
            `episode_judgment_cards` を横断して、今日使うもの、監視するもの、見送るものを一画面で確認できます。paid は履歴を使った personal hint も card 上に返します。
          </p>
          <div className={styles.heroMeta}>
            <span className={styles.heroBadge}>{isPaid ? "PAID" : "FREE"}</span>
            <span>{isPaid ? "判断の全文と archive を表示" : "最新1週間の judgment summary を表示"}</span>
          </div>
        </div>

        <MemberControls
          viewer={viewer}
          title="Decision Access"
          copy="無料版は judgment summary まで。有料会員になると action、deadline、watch points、threshold の詳細まで確認できます。"
        />
      </section>

      {error ? (
        <p className={styles.errorText}>判断カードの読み込みに失敗しました: {error}</p>
      ) : null}

      {!isPaid ? (
        <section className={styles.paywallBanner}>
          <div>
            <p className={styles.paywallEyebrow}>Free Preview</p>
            <h2>判断の深さを有料で開放します</h2>
            <p>
              無料版は最新1週間の judgment summary を確認できます。action、deadline、watch points、threshold の詳細と personal hint は有料会員で開放します。
            </p>
          </div>
          <Link href="/account" className={styles.paywallLink}>
            Upgrade
          </Link>
        </section>
      ) : null}

      <section className={styles.recommendationSection}>
        <div className={styles.recommendationHeader}>
          <div>
            <p className={styles.sectionEyebrow}>Next Best Decision</p>
            <h2>{isPaid ? "あなたへのおすすめ判断" : "今日の最優先判断"}</h2>
            <p className={styles.sectionCaption}>
              {isPaid
                ? "締切・判断タイプ・personal profile を使って、今日先に見るべき判断を並べています。"
                : "まず見るべき判断を一般優先ルールだけで先回り表示します。個人向け理由は paid で開放します。"}
            </p>
          </div>
          <div className={styles.countRow}>
            <span>{isPaid ? `${nextBestDecisions.length}件を優先表示` : "一般優先判断を表示"}</span>
          </div>
        </div>

        {nextBestDecisions.length === 0 ? (
          <p className={styles.emptyText}>優先判断を作れるカードはまだありません。</p>
        ) : (
          <div className={styles.recommendationGrid}>
            {nextBestDecisions.map((recommendation) => (
              <article key={recommendation.card.id} className={styles.recommendationCard}>
                <Link href={`/episodes/${recommendation.card.episode_id}`} className={styles.recommendationLink}>
                  <div className={styles.recommendationTopRow}>
                    <span className={`${styles.badge} ${styles[`badge_${recommendation.card.judgment_type}`]}`.trim()}>
                      {JUDGMENT_TYPE_LABELS[recommendation.card.judgment_type]}
                    </span>
                    <span className={`${styles.urgencyBadge} ${styles[`urgencyBadge_${recommendation.urgency_level}`]}`.trim()}>
                      {URGENCY_LEVEL_LABELS[recommendation.urgency_level]}
                    </span>
                  </div>
                  <div className={styles.recommendationMetaRow}>
                    <span className={styles.genreTag}>{recommendation.card.genre ?? "general"}</span>
                    <span className={styles.recommendationEpisodeLabel}>
                      {recommendation.card.episode_title ?? "Untitled episode"}
                    </span>
                  </div>
                  <h3>{recommendation.card.topic_title}</h3>
                  <p className={styles.summary}>{recommendation.card.judgment_summary}</p>
                  <dl className={styles.metaList}>
                    <div>
                      <dt>おすすめ行動</dt>
                      <dd>{recommendation.recommended_action}</dd>
                    </div>
                    <div>
                      <dt>期限</dt>
                      <dd>
                        {isPaid && recommendation.card.deadline_at
                          ? formatDeadline(recommendation.card.deadline_at)
                          : recommendation.deadline_label}
                      </dd>
                    </div>
                  </dl>
                  <ul className={styles.reasonTagList}>
                    {recommendation.reason_tags.map((tag) => (
                      <li key={tag}>{tag}</li>
                    ))}
                  </ul>
                  <p className={styles.episodeLinkText}>エピソードを見る</p>
                </Link>
              </article>
            ))}
          </div>
        )}

        {!isPaid ? (
          <div className={styles.recommendationFootnote}>
            <p className={styles.sectionEyebrow}>Free Preview</p>
            <h3>paid では「なぜあなたにこれを出したか」まで表示します</h3>
            <p>
              締切の近さに加えて、後悔しやすい frame や満足率の高い genre を使って 3 件まで優先判断を返します。
            </p>
            <Link href="/account" className={styles.inlineUpgradeLink}>
              Personal priority を開放
            </Link>
          </div>
        ) : null}
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.sectionEyebrow}>Today</p>
            <h2>今日の判断</h2>
            <p className={styles.sectionCaption}>{todayLabel}</p>
          </div>
          <div className={styles.countRow}>
            <span>{JUDGMENT_TYPE_LABELS.use_now} {groupedCards.use_now.length}件</span>
            <span>{JUDGMENT_TYPE_LABELS.watch} {groupedCards.watch.length}件</span>
            <span>{JUDGMENT_TYPE_LABELS.skip} {groupedCards.skip.length}件</span>
          </div>
        </div>

        {todayCards.length === 0 ? (
          <p className={styles.emptyText}>判断カードはまだありません。</p>
        ) : (
          <div className={styles.grid}>{todayCards.map((card) => renderDecisionCard(card, "元エピソード", card.episode_title ?? "Untitled episode"))}</div>
        )}
      </section>

      {(["use_now", "watch", "skip"] as const).map((judgmentType) => {
        const sectionCards = groupedCards[judgmentType];

        return (
          <section key={judgmentType} className={styles.section}>
            <div className={styles.sectionHeading}>
              <div>
                <p className={styles.sectionEyebrow}>{JUDGMENT_TYPE_DESCRIPTIONS[judgmentType]}</p>
                <h2>{JUDGMENT_TYPE_LABELS[judgmentType]}</h2>
              </div>
              <span className={styles.sectionCount}>{sectionCards.length}件</span>
            </div>

            {sectionCards.length === 0 ? (
              <p className={styles.emptyText}>この分類の判断はまだありません。</p>
            ) : (
              <div className={styles.grid}>
                {sectionCards.map((card) =>
                  renderDecisionCard(card, "公開日", formatDecisionDate(card.episode_published_at))
                )}
              </div>
            )}
          </section>
        );
      })}
    </main>
  );
}
