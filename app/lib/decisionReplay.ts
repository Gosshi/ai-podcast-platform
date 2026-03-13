import type { JudgmentThresholdJson, JudgmentType } from "../../src/lib/judgmentCards.ts";
import { EMPTY_DECISION_PROFILE, buildPersonalDecisionProfile, type DecisionProfile } from "../../src/lib/decisionProfile.ts";
import type { DecisionOutcome } from "./decisionHistory.ts";
import { formatThresholdHighlights, lockJudgmentDetails } from "./judgmentAccess.ts";
import { createServiceRoleClient } from "./supabaseClients.ts";

export type DecisionReplay = {
  id: string;
  judgment_card_id: string;
  episode_id: string;
  topic_title: string;
  genre: string | null;
  frame_type: string | null;
  judgment_type: JudgmentType;
  decision_type: JudgmentType;
  judgment_summary: string;
  action_text: string | null;
  deadline_at: string | null;
  watch_points: string[];
  threshold_json: JudgmentThresholdJson;
  threshold_highlights: string[];
  created_at: string;
  outcome: DecisionOutcome;
  outcome_updated_at: string;
  episode_title: string | null;
  episode_published_at: string | null;
};

export type DecisionReplayInsight = {
  key: string;
  title: string;
  body: string;
  tone: "positive" | "caution" | "neutral";
};

type UserDecisionRow = {
  id: string;
  judgment_card_id: string;
  episode_id: string;
  decision_type: JudgmentType;
  outcome: DecisionOutcome;
  created_at: string;
  updated_at: string;
};

type ReplayCardRow = {
  id: string;
  topic_title: string;
  genre: string | null;
  frame_type: string | null;
  judgment_type: JudgmentType;
  judgment_summary: string;
  action_text: string | null;
  deadline_at: string | null;
  threshold_json: JudgmentThresholdJson | null;
  watch_points_json: unknown;
};

type EpisodeLookupRow = {
  id: string;
  title: string | null;
  published_at: string | null;
};

type ReplayInsightCandidate = DecisionReplayInsight & {
  score: number;
};

const DECISION_REPLAY_BASE_PATH = "/history/replay";

export const buildDecisionReplayPath = (decisionId: string): string => {
  return `${DECISION_REPLAY_BASE_PATH}/${decisionId}`;
};

export const formatDecisionReplayDateTime = (value: string | null): string => {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("ja-JP", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
};

const normalizeThresholdJson = (value: JudgmentThresholdJson | null | undefined): JudgmentThresholdJson => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value;
};

const parseWatchPoints = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item) => item.length > 0)
    .slice(0, 5);
};

export const buildDecisionReplayView = (replay: DecisionReplay, isPaid: boolean): DecisionReplay => {
  if (isPaid) {
    return replay;
  }

  const lockedReplay = lockJudgmentDetails(replay);

  return {
    ...replay,
    ...lockedReplay,
    threshold_highlights: []
  };
};

export const buildDecisionReplayInsights = (
  replay: DecisionReplay,
  profile: DecisionProfile
): DecisionReplayInsight[] => {
  const candidates: ReplayInsightCandidate[] = [];
  const decisionTypeStat = profile.decisionTypeStats[replay.decision_type];
  const frameStat = replay.frame_type
    ? profile.frameTypeStats.find((segment) => segment.key === replay.frame_type)
    : null;

  if (replay.outcome === "success") {
    candidates.push({
      key: "outcome-success",
      title: "この判断は満足につながりました",
      body: "保存された outcome は「満足」でした。当時見ていた条件を次回も再現できると、似た判断の精度を上げやすくなります。",
      tone: "positive",
      score: 60
    });
  }

  if (replay.outcome === "regret") {
    candidates.push({
      key: "outcome-regret",
      title: "この判断は後悔として残りました",
      body: "結果は「後悔」でした。どの条件を軽く見たかを replay で残しておくと、次回の recommendation 改善に使いやすくなります。",
      tone: "caution",
      score: 60
    });
  }

  if (profile.totalDecisions >= 3 && decisionTypeStat.count >= 3) {
    if (replay.outcome === "success" && decisionTypeStat.successRate >= 67) {
      candidates.push({
        key: `decision-type-success:${replay.decision_type}`,
        title: `「${replay.decision_type === "use_now" ? "使う" : replay.decision_type === "watch" ? "監視" : "見送り"}」判断は相性が良いかもしれません`,
        body: `この判断タイプは履歴${decisionTypeStat.count}件中${decisionTypeStat.successCount}件が満足です。今回も同じ型で良い結果になっています。`,
        tone: "positive",
        score: decisionTypeStat.successRate + decisionTypeStat.count * 4
      });
    }

    if (replay.outcome === "regret" && decisionTypeStat.regretRate >= 50) {
      candidates.push({
        key: `decision-type-regret:${replay.decision_type}`,
        title: `「${replay.decision_type === "use_now" ? "使う" : replay.decision_type === "watch" ? "監視" : "見送り"}」判断は見直し余地がありそうです`,
        body: `この判断タイプは履歴${decisionTypeStat.count}件中${decisionTypeStat.regretCount}件が後悔です。今回も同じ流れなら、判断前の終了条件を明確にすると振り返りやすくなります。`,
        tone: "caution",
        score: decisionTypeStat.regretRate + decisionTypeStat.count * 4
      });
    }
  }

  if (frameStat && frameStat.count >= 3) {
    if (replay.outcome === "success" && frameStat.successRate >= 67) {
      candidates.push({
        key: `frame-success:${frameStat.key}`,
        title: `${frameStat.label} は安定して機能している可能性があります`,
        body: `この frame は履歴${frameStat.count}件中${frameStat.successCount}件が満足です。今回の replay も同じ流れで噛み合っています。`,
        tone: "positive",
        score: frameStat.successRate + frameStat.count * 3
      });
    }

    if (replay.outcome === "regret" && frameStat.regretRate >= 50) {
      candidates.push({
        key: `frame-regret:${frameStat.key}`,
        title: `${frameStat.label} は慎重に使ったほうが良いかもしれません`,
        body: `この frame は履歴${frameStat.count}件中${frameStat.regretCount}件が後悔です。次回は別 frame と比較してから採用するとブレを抑えやすそうです。`,
        tone: "caution",
        score: frameStat.regretRate + frameStat.count * 3
      });
    }
  }

  if (replay.decision_type === "watch" && replay.outcome === "regret") {
    candidates.push({
      key: "watch-regret",
      title: "watch を長く置くと後悔に寄りやすいかもしれません",
      body: "今回は「監視」のまま後悔に着地しました。次回は watch の終了条件か期限を先に決めておくと、放置を減らしやすくなります。",
      tone: "caution",
      score: 78
    });
  }

  if (!replay.deadline_at && replay.outcome === "regret") {
    candidates.push({
      key: "deadline-missing",
      title: "次回は deadline を重視したほうが良いかもしれません",
      body: "この replay には明確な期限が残っていません。期限がない判断は、比較や再評価のタイミングを逃しやすくなります。",
      tone: "caution",
      score: 72
    });
  }

  if (replay.deadline_at && replay.outcome === "success") {
    candidates.push({
      key: "deadline-helped",
      title: "期限がある判断は振り返りやすい傾向です",
      body: "今回は deadline を持ったまま満足につながりました。再確認日がある判断は、profile に学習を返しやすくなります。",
      tone: "positive",
      score: 70
    });
  }

  if (replay.watch_points.length > 0 && replay.outcome === "success") {
    candidates.push({
      key: "watch-points-helped",
      title: "watch point を持てた判断は再現しやすそうです",
      body: "監視ポイントが残っている判断は、何を見て決めたかを再利用しやすくなります。今回の満足もその整理が効いていた可能性があります。",
      tone: "neutral",
      score: 64
    });
  }

  if (replay.watch_points.length === 0 && replay.outcome === "regret") {
    candidates.push({
      key: "watch-points-missing",
      title: "判断条件をもう少し言語化すると良さそうです",
      body: "この replay では watch point が残っていません。次回は比較観点を2つか3つだけでも残すと、後悔理由を切り分けやすくなります。",
      tone: "neutral",
      score: 62
    });
  }

  if (candidates.length === 0) {
    candidates.push({
      key: "data-light",
      title: "まだ強い傾向は出ていません",
      body: "この replay は profile と recommendation を育てるための基礎データになります。履歴が増えるほど、より具体的な学びを返しやすくなります。",
      tone: "neutral",
      score: 1
    });
  }

  return candidates
    .sort((left, right) => right.score - left.score)
    .reduce((items, candidate) => {
      if (items.some((item) => item.key === candidate.key)) {
        return items;
      }

      items.push({
        key: candidate.key,
        title: candidate.title,
        body: candidate.body,
        tone: candidate.tone
      });
      return items;
    }, [] as DecisionReplayInsight[])
    .slice(0, 3);
};

export const loadDecisionReplay = async (
  userId: string,
  decisionId: string
): Promise<{ replay: DecisionReplay | null; profile: DecisionProfile; insights: DecisionReplayInsight[]; error: string | null }> => {
  if (!userId || !decisionId.trim()) {
    return {
      replay: null,
      profile: EMPTY_DECISION_PROFILE,
      insights: [],
      error: null
    };
  }

  try {
    const supabase = createServiceRoleClient();
    const { data: decisionData, error: decisionError } = await supabase
      .from("user_decisions")
      .select("id, judgment_card_id, episode_id, decision_type, outcome, created_at, updated_at")
      .eq("user_id", userId)
      .eq("id", decisionId)
      .maybeSingle();

    if (decisionError) {
      return {
        replay: null,
        profile: EMPTY_DECISION_PROFILE,
        insights: [],
        error: decisionError.message
      };
    }

    const decision = (decisionData as UserDecisionRow | null) ?? null;
    if (!decision) {
      return {
        replay: null,
        profile: EMPTY_DECISION_PROFILE,
        insights: [],
        error: null
      };
    }

    const [{ data: cardData, error: cardError }, { data: episodeData, error: episodeError }, historyResult] =
      await Promise.all([
        supabase
          .from("episode_judgment_cards")
          .select(
            "id, topic_title, genre, frame_type, judgment_type, judgment_summary, action_text, deadline_at, threshold_json, watch_points_json"
          )
          .eq("id", decision.judgment_card_id)
          .maybeSingle(),
        supabase.from("episodes").select("id, title, published_at").eq("id", decision.episode_id).maybeSingle(),
        supabase
          .from("user_decisions")
          .select("judgment_card_id, decision_type, outcome")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(200)
      ]);

    if (cardError) {
      return {
        replay: null,
        profile: EMPTY_DECISION_PROFILE,
        insights: [],
        error: cardError.message
      };
    }

    if (episodeError) {
      return {
        replay: null,
        profile: EMPTY_DECISION_PROFILE,
        insights: [],
        error: episodeError.message
      };
    }

    if (historyResult.error) {
      return {
        replay: null,
        profile: EMPTY_DECISION_PROFILE,
        insights: [],
        error: historyResult.error.message
      };
    }

    const historyRows = ((historyResult.data as Array<Pick<UserDecisionRow, "judgment_card_id" | "decision_type" | "outcome">> | null) ??
      []) as Array<Pick<UserDecisionRow, "judgment_card_id" | "decision_type" | "outcome">>;
    const historyCardIds = Array.from(new Set(historyRows.map((row) => row.judgment_card_id)));

    const { data: historyCardsData, error: historyCardsError } = historyCardIds.length
      ? await supabase
          .from("episode_judgment_cards")
          .select("id, frame_type, genre, threshold_json")
          .in("id", historyCardIds)
      : await Promise.resolve({ data: [], error: null });

    if (historyCardsError) {
      return {
        replay: null,
        profile: EMPTY_DECISION_PROFILE,
        insights: [],
        error: historyCardsError.message
      };
    }

    const historyCards = (((historyCardsData as Array<{
      id: string;
      frame_type: string | null;
      genre: string | null;
      threshold_json: JudgmentThresholdJson | null;
    }> | null) ?? []) as Array<{
      id: string;
      frame_type: string | null;
      genre: string | null;
      threshold_json: JudgmentThresholdJson | null;
    }>).reduce((map, row) => {
      map.set(row.id, row);
      return map;
    }, new Map<string, { id: string; frame_type: string | null; genre: string | null; threshold_json: JudgmentThresholdJson | null }>());

    const profile = buildPersonalDecisionProfile(
      historyRows.map((row) => {
        const card = historyCards.get(row.judgment_card_id);

        return {
          decision_type: row.decision_type,
          outcome: row.outcome,
          frame_type: card?.frame_type ?? null,
          genre: card?.genre ?? null,
          threshold_json: normalizeThresholdJson(card?.threshold_json ?? {})
        };
      })
    );

    const card = (cardData as ReplayCardRow | null) ?? null;
    const episode = (episodeData as EpisodeLookupRow | null) ?? null;

    if (!card) {
      return {
        replay: null,
        profile,
        insights: [],
        error: "judgment_card_not_found"
      };
    }

    const replay: DecisionReplay = {
      id: decision.id,
      judgment_card_id: decision.judgment_card_id,
      episode_id: decision.episode_id,
      topic_title: card.topic_title,
      genre: card.genre ?? null,
      frame_type: card.frame_type ?? null,
      judgment_type: card.judgment_type,
      decision_type: decision.decision_type,
      judgment_summary: card.judgment_summary,
      action_text: card.action_text,
      deadline_at: card.deadline_at,
      watch_points: parseWatchPoints(card.watch_points_json),
      threshold_json: normalizeThresholdJson(card.threshold_json),
      threshold_highlights: formatThresholdHighlights(normalizeThresholdJson(card.threshold_json)),
      created_at: decision.created_at,
      outcome: decision.outcome,
      outcome_updated_at: decision.updated_at,
      episode_title: episode?.title ?? null,
      episode_published_at: episode?.published_at ?? null
    };

    return {
      replay,
      profile,
      insights: buildDecisionReplayInsights(replay, profile),
      error: null
    };
  } catch (error) {
    return {
      replay: null,
      profile: EMPTY_DECISION_PROFILE,
      insights: [],
      error: error instanceof Error ? error.message : "unknown_error"
    };
  }
};
