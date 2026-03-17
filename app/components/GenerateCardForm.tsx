"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { track } from "@/src/lib/analytics";
import styles from "./generate-card-form.module.css";

type GeneratedCard = {
  id: string;
  input_text: string;
  topic_title: string;
  genre: string | null;
  judgment_type: "use_now" | "watch" | "skip";
  judgment_summary: string;
  action_text: string | null;
  deadline_at: string | null;
  threshold_json: Record<string, unknown>;
  watch_points_json: string[];
  confidence_score: number | null;
  outcome: "success" | "regret" | "neutral" | null;
  created_at: string;
};

type ListResponse =
  | { ok: true; cards: GeneratedCard[]; remaining: number }
  | { ok: false; error: string };

type ErrorResponse = {
  ok: false;
  error: string;
  limit?: number;
  remaining?: number;
  minLength?: number;
  maxLength?: number;
};

type OutcomeResponse =
  | { ok: true; card: { id: string; outcome: string } }
  | { ok: false; error: string };

type StreamPhase = "idle" | "connecting" | "generating" | "done";

type SSEDoneData = {
  card?: GeneratedCard;
  remaining?: number;
};

type SSEErrorData = {
  error?: string;
};

const JUDGMENT_TYPE_LABELS: Record<string, string> = {
  use_now: "おすすめ: 今すぐ",
  watch: "おすすめ: 様子見",
  skip: "おすすめ: 見送り"
};

const OUTCOME_LABELS: Record<string, string> = {
  success: "満足",
  neutral: "普通",
  regret: "後悔"
};

const GENRE_LABELS: Record<string, string> = {
  streaming: "サブスク",
  tech: "テック",
  shopping: "買い物",
  lifestyle: "生活",
  work: "仕事",
  entertainment: "エンタメ"
};

const parseSSELines = (
  text: string,
  onEvent: (eventName: string, data: string) => void
): string => {
  const lines = text.split("\n");
  let currentEvent = "";
  let remainder = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (i === lines.length - 1 && !text.endsWith("\n")) {
      remainder = line;
      break;
    }

    if (line.startsWith("event: ")) {
      currentEvent = line.slice(7).trim();
    } else if (line.startsWith("data: ")) {
      const data = line.slice(6);
      if (currentEvent) {
        onEvent(currentEvent, data);
        currentEvent = "";
      }
    } else if (line === "") {
      currentEvent = "";
    }
  }

  return remainder;
};

type GenerateCardFormProps = {
  isPaid: boolean;
  showWelcome?: boolean;
};

export default function GenerateCardForm({ isPaid, showWelcome = false }: GenerateCardFormProps) {
  const [inputText, setInputText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [streamPhase, setStreamPhase] = useState<StreamPhase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [cards, setCards] = useState<GeneratedCard[]>([]);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [updatingOutcome, setUpdatingOutcome] = useState<string | null>(null);
  const [justGeneratedId, setJustGeneratedId] = useState<string | null>(null);
  const skeletonRef = useRef<HTMLDivElement>(null);

  const loadCards = useCallback(async () => {
    try {
      const response = await fetch("/api/generate-card");
      const data = (await response.json().catch(() => null)) as ListResponse | null;
      if (data?.ok) {
        setCards(data.cards);
        setRemaining(data.remaining);
      }
    } catch {
      // Silent fail on initial load
    }
  }, []);

  useEffect(() => {
    void loadCards();
  }, [loadCards]);

  const handleErrorCode = (apiError: string) => {
    if (apiError === "daily_limit_reached") {
      setError(
        isPaid
          ? "本日の生成上限（20回）に達しました。明日また利用できます。"
          : "無料版の生成上限（3回/日）に達しました。有料版にすると20回/日まで生成できます。"
      );
    } else if (apiError === "input_too_short") {
      setError("もう少し詳しく入力してください。");
    } else if (apiError === "input_too_long") {
      setError("入力が長すぎます。500文字以内にしてください。");
    } else if (apiError === "ai_timeout") {
      setError("AIの応答がタイムアウトしました。時間をおいて再度お試しください。");
    } else {
      setError("カードの生成に失敗しました。時間をおいて再度お試しください。");
    }
  };

  const onSubmit = async () => {
    if (!inputText.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setStreamPhase("connecting");
    setError(null);

    try {
      const response = await fetch("/api/generate-card", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inputText: inputText.trim() })
      });

      // Non-streaming error responses (auth, validation, rate limit)
      if (!response.ok) {
        const errorData = (await response.json().catch(() => null)) as ErrorResponse | null;
        handleErrorCode(errorData?.error ?? "generate_failed");
        setStreamPhase("idle");
        setIsSubmitting(false);
        return;
      }

      // SSE stream
      const reader = response.body?.getReader();
      if (!reader) {
        setError("カードの生成に失敗しました。時間をおいて再度お試しください。");
        setStreamPhase("idle");
        setIsSubmitting(false);
        return;
      }

      setStreamPhase("generating");

      // Scroll skeleton into view
      requestAnimationFrame(() => {
        skeletonRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      });

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        buffer = parseSSELines(buffer, (eventName, data) => {
          try {
            if (eventName === "done") {
              const parsed = JSON.parse(data) as SSEDoneData;
              if (parsed.card) {
                setCards((prev) => [parsed.card as GeneratedCard, ...prev]);
                setJustGeneratedId(parsed.card.id);
                setInputText("");
                track("generate_card_submit", {
                  page: "/decisions",
                  source: "generate_card_form",
                  judgment_type: parsed.card.judgment_type,
                  genre: parsed.card.genre ?? undefined
                });
              }
              if (parsed.remaining !== undefined) {
                setRemaining(parsed.remaining);
              }
              setStreamPhase("done");
            } else if (eventName === "error") {
              const parsed = JSON.parse(data) as SSEErrorData;
              handleErrorCode(parsed.error ?? "generate_failed");
              setStreamPhase("idle");
            }
          } catch {
            // Skip malformed SSE data
          }
        });
      }

      setStreamPhase("idle");
    } catch {
      setError("カードの生成に失敗しました。時間をおいて再度お試しください。");
      setStreamPhase("idle");
    } finally {
      setIsSubmitting(false);
    }
  };

  const onOutcome = async (cardId: string, outcome: "success" | "regret" | "neutral") => {
    setUpdatingOutcome(cardId);
    try {
      const response = await fetch(`/api/generate-card/${cardId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outcome })
      });

      const data = (await response.json().catch(() => null)) as OutcomeResponse | null;
      if (data?.ok) {
        setCards((prev) =>
          prev.map((c) => (c.id === cardId ? { ...c, outcome: outcome } : c))
        );
        track("generate_card_outcome", {
          page: "/decisions",
          source: "generate_card_form",
          action_name: outcome,
          card_id: cardId
        });
      }
    } catch {
      // Silent fail
    } finally {
      setUpdatingOutcome(null);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      void onSubmit();
    }
  };

  return (
    <section className={`${styles.section} ${showWelcome ? styles.sectionHighlight : ""}`.trim()} id="ai-consult">
      {showWelcome ? (
        <div className={styles.welcomeBanner}>
          <p className={styles.welcomeTitle}>🎉 設定が完了しました！</p>
          <p className={styles.welcomeBody}>
            さっそく迷っていることを入力してみましょう。AIがあなたの好みに合わせたトピックカードを作ります。
          </p>
        </div>
      ) : null}
      <p className={styles.eyebrow}>AI相談</p>
      <h2 className={styles.heading}>AIに相談する</h2>
      <p className={styles.caption}>
        迷っていることを入力すると、AIがトピックカードを生成します。
      </p>

      <div className={styles.form}>
        <textarea
          className={styles.textarea}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="例: Netflixを解約すべきか、新しいMacBookを買うか迷っている、今月のサブスクを見直したい"
          maxLength={500}
          disabled={isSubmitting}
        />
        <div className={styles.formFooter}>
          <button
            type="button"
            className={styles.submitButton}
            onClick={() => void onSubmit()}
            disabled={isSubmitting || inputText.trim().length < 5}
          >
            {isSubmitting ? "生成中..." : "トピックカードを生成"}
          </button>
          {remaining !== null ? (
            <span className={styles.remaining}>
              今日の残り: {remaining}回
            </span>
          ) : null}
        </div>
        {error ? <p className={styles.error}>{error}</p> : null}
      </div>

      {streamPhase === "generating" || streamPhase === "connecting" ? (
        <div className={styles.resultList}>
          <article className={`${styles.resultCard} ${styles.skeletonCard}`} ref={skeletonRef}>
            <div className={styles.cardTopRow}>
              <span className={`${styles.badge} ${styles.skeletonBadge}`}>
                <span className={styles.shimmer} />
              </span>
            </div>
            <div className={`${styles.skeletonLine} ${styles.skeletonLineShort}`}>
              <span className={styles.shimmer} />
            </div>
            <div className={`${styles.skeletonLine} ${styles.skeletonLineMedium}`}>
              <span className={styles.shimmer} />
            </div>
            <div className={`${styles.skeletonLine} ${styles.skeletonLineFull}`}>
              <span className={styles.shimmer} />
            </div>
            <div className={`${styles.skeletonLine} ${styles.skeletonLineLong}`}>
              <span className={styles.shimmer} />
            </div>
            <div className={styles.skeletonStatus}>
              <span className={styles.skeletonDot} />
              AIが判断を考えています...
            </div>
          </article>
        </div>
      ) : null}

      {cards.length > 0 ? (
        <div className={styles.resultList}>
          {cards.map((card) => (
            <article
              key={card.id}
              className={`${styles.resultCard} ${card.id === justGeneratedId ? styles.resultCardNew : ""}`.trim()}
            >
              <div className={styles.cardTopRow}>
                <span className={`${styles.badge} ${styles[`badge_${card.judgment_type}`]}`.trim()}>
                  {JUDGMENT_TYPE_LABELS[card.judgment_type] ?? card.judgment_type}
                </span>
                {card.genre ? (
                  <span className={styles.genreTag}>
                    {GENRE_LABELS[card.genre] ?? card.genre}
                  </span>
                ) : null}
              </div>

              <p className={styles.inputLabel}>
                相談: {card.input_text}
              </p>

              <h3 className={styles.cardTitle}>{card.topic_title}</h3>
              <p className={styles.cardSummary}>{card.judgment_summary}</p>

              {card.action_text ? (
                <dl className={styles.metaList}>
                  <div className={styles.metaItem}>
                    <dt className={styles.metaDt}>次の行動</dt>
                    <dd className={styles.metaDd}>{card.action_text}</dd>
                  </div>
                </dl>
              ) : null}

              {Array.isArray(card.watch_points_json) && card.watch_points_json.length > 0 ? (
                <div>
                  <span className={styles.metaDt}>注目ポイント</span>
                  <ul className={styles.watchPointList}>
                    {card.watch_points_json.map((point, i) => (
                      <li key={i}>{point}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {card.outcome ? (
                <div className={styles.actionRow}>
                  <span className={`${styles.outcomeBadge} ${styles[`outcome_${card.outcome}`]}`.trim()}>
                    結果: {OUTCOME_LABELS[card.outcome] ?? card.outcome}
                  </span>
                </div>
              ) : (
                <div className={styles.actionRow}>
                  <button
                    type="button"
                    className={`${styles.actionButton} ${styles.actionButtonPrimary}`}
                    onClick={() => void onOutcome(card.id, "success")}
                    disabled={updatingOutcome === card.id}
                  >
                    採用する
                  </button>
                  <button
                    type="button"
                    className={styles.actionButton}
                    onClick={() => void onOutcome(card.id, "neutral")}
                    disabled={updatingOutcome === card.id}
                  >
                    後で考える
                  </button>
                  <button
                    type="button"
                    className={styles.actionButton}
                    onClick={() => void onOutcome(card.id, "regret")}
                    disabled={updatingOutcome === card.id}
                  >
                    見送る
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}
