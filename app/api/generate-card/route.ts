import { verifyCsrfOrigin } from "@/app/lib/csrf";
import { getViewerFromCookies } from "@/app/lib/viewer";
import { createServiceRoleClient } from "@/app/lib/supabaseClients";
import {
  INTEREST_TOPIC_LABELS,
  ACTIVE_SUBSCRIPTION_LABELS
} from "@/src/lib/userPreferences";

export const runtime = "nodejs";

const FREE_DAILY_LIMIT = 3;
const PAID_DAILY_LIMIT = 20;
const MAX_INPUT_LENGTH = 500;
const MIN_INPUT_LENGTH = 5;

const jsonResponse = (body: Record<string, unknown>, status = 200): Response => {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  });
};

const toNonEmptyString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const todayStartJST = (): string => {
  const now = new Date();
  const jstOffset = 9 * 60 * 60 * 1000;
  const jstNow = new Date(now.getTime() + jstOffset);
  const dateStr = jstNow.toISOString().slice(0, 10);
  return `${dateStr}T00:00:00+09:00`;
};

const SYSTEM_PROMPT = `あなたはユーザーの悩みに対してアドバイスするAIアシスタントです。
ユーザーが悩んでいることを聞いて、以下のJSON形式でトピックカードを1枚生成してください。

ユーザーのプロフィール情報が付与される場合があります。その場合は：
- ユーザーの重視する観点（コスト重視、時間重視など）に合わせた理由を述べる
- ユーザーが利用中のサービスに関連する悩みなら、そのサービスの特徴を踏まえて回答する
- ユーザーの興味分野に合わせた具体的な行動を提案する
- 予算に慎重なユーザーにはコスト面を明確にし、時間がないユーザーには簡潔な行動を提案する

出力JSON形式:
{
  "topic_title": "トピックの短いタイトル（20文字以内）",
  "genre": "streaming" または "tech" または "shopping" または "lifestyle" または "work" または "entertainment" または null,
  "judgment_type": "use_now" または "watch" または "skip",
  "judgment_summary": "要約と理由（1-2文、100文字以内）",
  "action_text": "次にとるべき具体的な行動（1文、60文字以内）",
  "deadline_at": null,
  "watch_points": ["注目すべきポイント1", "ポイント2"],
  "confidence_score": 0.65から0.95の間の数値
}

ルール:
- judgment_type は悩みの内容から適切なものを選ぶ
  - use_now: 今すぐ採用・購入・実行すべき場合
  - watch: もう少し様子を見る・比較検討する場合
  - skip: 見送る・やめておく場合
- watch_points は1〜3個
- 悩みが曖昧な場合は watch を選び、具体的な比較ポイントを提案する
- judgment_summary は根拠を含めて判断理由を短く述べる
- action_text は具体的で今日できる行動にする
- 日本語で回答する
- JSON以外は出力しない`;

// Labels imported from src/lib/userPreferences.ts

const buildUserContext = (profile: {
  decisionPriority?: string;
  budgetSensitivity?: string | null;
  dailyAvailableTime?: string;
  interestTopics?: string[];
  activeSubscriptions?: string[];
  primaryInterestTopic?: string | null;
  discoveryMode?: boolean;
  moneySensitive?: boolean;
  timeSensitive?: boolean;
  regretAverse?: boolean;
} | null): string => {
  if (!profile) return "";

  const sections: string[] = [];

  // Decision priority
  const priorityLabels: Record<string, string> = {
    save_money: "コストを重視",
    save_time: "時間効率を重視",
    avoid_regret: "後悔を避けたい",
    discover_new: "新しいものを試したい"
  };
  if (profile.decisionPriority && priorityLabels[profile.decisionPriority]) {
    sections.push(`重視する観点: ${priorityLabels[profile.decisionPriority]}`);
  }

  // Interest topics
  if (profile.interestTopics && profile.interestTopics.length > 0) {
    const topicLabels = profile.interestTopics
      .map((t) => (INTEREST_TOPIC_LABELS as Record<string, string>)[t])
      .filter(Boolean)
      .slice(0, 4);
    if (topicLabels.length > 0) {
      sections.push(`興味のある分野: ${topicLabels.join("、")}`);
    }
  }

  // Active subscriptions
  if (profile.activeSubscriptions && profile.activeSubscriptions.length > 0) {
    const subLabels = profile.activeSubscriptions
      .filter((s) => s !== "none" && s !== "other")
      .map((s) => (ACTIVE_SUBSCRIPTION_LABELS as Record<string, string>)[s])
      .filter(Boolean)
      .slice(0, 4);
    if (subLabels.length > 0) {
      sections.push(`利用中のサービス: ${subLabels.join("、")}`);
    }
  }

  // Budget and time constraints
  const constraints: string[] = [];
  if (profile.moneySensitive || profile.budgetSensitivity === "high") {
    constraints.push("予算に慎重");
  }
  if (profile.timeSensitive || profile.dailyAvailableTime === "under_30m") {
    constraints.push("時間に限りがある");
  }
  if (profile.regretAverse) {
    constraints.push("慎重に判断したい");
  }
  if (profile.discoveryMode) {
    constraints.push("新しい選択肢にもオープン");
  }
  if (constraints.length > 0) {
    sections.push(`傾向: ${constraints.join("、")}`);
  }

  if (sections.length === 0) return "";

  return `\n\n【ユーザープロフィール】\n${sections.join("\n")}\n\n上記プロフィールを考慮し、このユーザーに合った判断・行動提案をしてください。ユーザーが使っているサービスに関連する悩みの場合は、そのサービスの具体的な機能や料金も踏まえて判断してください。`;
};

type GenerateCardRequest = {
  inputText?: unknown;
};

type OpenAIMessage = {
  role: string;
  content: string;
};

type OpenAIChoice = {
  message?: OpenAIMessage;
};

type OpenAIResponse = {
  choices?: OpenAIChoice[];
  error?: { message?: string };
};

type GeneratedCardJson = {
  topic_title?: unknown;
  genre?: unknown;
  judgment_type?: unknown;
  judgment_summary?: unknown;
  action_text?: unknown;
  deadline_at?: unknown;
  watch_points?: unknown;
  confidence_score?: unknown;
};

const VALID_JUDGMENT_TYPES = new Set(["use_now", "watch", "skip"]);
const VALID_GENRES = new Set(["streaming", "tech", "shopping", "lifestyle", "work", "entertainment"]);

const parseGeneratedCard = (raw: GeneratedCardJson) => {
  const judgmentType =
    typeof raw.judgment_type === "string" && VALID_JUDGMENT_TYPES.has(raw.judgment_type)
      ? (raw.judgment_type as "use_now" | "watch" | "skip")
      : "watch";

  const genre =
    typeof raw.genre === "string" && VALID_GENRES.has(raw.genre) ? raw.genre : null;

  const topicTitle =
    typeof raw.topic_title === "string" && raw.topic_title.trim().length > 0
      ? raw.topic_title.trim().slice(0, 40)
      : "トピックカード";

  const judgmentSummary =
    typeof raw.judgment_summary === "string" && raw.judgment_summary.trim().length > 0
      ? raw.judgment_summary.trim().slice(0, 200)
      : "AIがトピックカードを生成しました。";

  const actionText =
    typeof raw.action_text === "string" && raw.action_text.trim().length > 0
      ? raw.action_text.trim().slice(0, 120)
      : null;

  const watchPoints = Array.isArray(raw.watch_points)
    ? raw.watch_points.filter((p): p is string => typeof p === "string" && p.trim().length > 0).slice(0, 5)
    : [];

  const confidenceScore =
    typeof raw.confidence_score === "number" &&
    raw.confidence_score >= 0 &&
    raw.confidence_score <= 1
      ? Math.round(raw.confidence_score * 1000) / 1000
      : 0.7;

  return {
    topic_title: topicTitle,
    genre,
    frame_type: null,
    judgment_type: judgmentType,
    judgment_summary: judgmentSummary,
    action_text: actionText,
    deadline_at: null,
    threshold_json: {},
    watch_points_json: watchPoints,
    confidence_score: confidenceScore
  };
};

export async function POST(request: Request) {
  const csrf = verifyCsrfOrigin(request);
  if (!csrf.ok) {
    return jsonResponse({ ok: false, error: csrf.error }, 403);
  }

  const viewer = await getViewerFromCookies();
  if (!viewer) {
    return jsonResponse({ ok: false, error: "unauthorized" }, 401);
  }

  const body = (await request.json().catch(() => ({}))) as GenerateCardRequest;
  const inputText = toNonEmptyString(body.inputText);
  if (!inputText) {
    return jsonResponse({ ok: false, error: "input_text_required" }, 400);
  }

  if (inputText.length < MIN_INPUT_LENGTH) {
    return jsonResponse({ ok: false, error: "input_too_short", minLength: MIN_INPUT_LENGTH }, 400);
  }

  if (inputText.length > MAX_INPUT_LENGTH) {
    return jsonResponse({ ok: false, error: "input_too_long", maxLength: MAX_INPUT_LENGTH }, 400);
  }

  const supabase = createServiceRoleClient();

  // Rate limit check
  const dailyLimit = viewer.isPaid ? PAID_DAILY_LIMIT : FREE_DAILY_LIMIT;
  const startOfDay = todayStartJST();

  const { count, error: countError } = await supabase
    .from("user_generated_cards")
    .select("id", { count: "exact", head: true })
    .eq("user_id", viewer.userId)
    .gte("created_at", startOfDay);

  if (countError) {
    return jsonResponse({ ok: false, error: countError.message }, 500);
  }

  const usedCount = count ?? 0;
  if (usedCount >= dailyLimit) {
    return jsonResponse(
      {
        ok: false,
        error: "daily_limit_reached",
        limit: dailyLimit,
        remaining: 0
      },
      429
    );
  }

  // Call OpenAI
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return jsonResponse({ ok: false, error: "ai_not_configured" }, 503);
  }

  const userContext = buildUserContext(viewer.preferenceProfile);
  const userMessage = `${inputText}${userContext}`;
  const remainingAfter = dailyLimit - usedCount - 1;

  const encoder = new TextEncoder();
  const sseEvent = (event: string, data: Record<string, unknown>): Uint8Array =>
    encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

  const userId = viewer.userId;
  const stream = new ReadableStream({
    async start(controller) {
      controller.enqueue(sseEvent("status", { status: "generating" }));

      let aiResponse: Response;
      try {
        aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            temperature: 0.7,
            response_format: { type: "json_object" },
            messages: [
              { role: "system", content: SYSTEM_PROMPT },
              { role: "user", content: userMessage }
            ]
          }),
          signal: AbortSignal.timeout(30_000)
        });
      } catch {
        controller.enqueue(sseEvent("error", { error: "ai_timeout" }));
        controller.close();
        return;
      }

      if (!aiResponse.ok) {
        controller.enqueue(sseEvent("error", { error: "ai_error" }));
        controller.close();
        return;
      }

      const aiBody = (await aiResponse.json().catch(() => null)) as OpenAIResponse | null;
      const rawContent = aiBody?.choices?.[0]?.message?.content;

      if (!rawContent) {
        controller.enqueue(sseEvent("error", { error: "ai_empty_response" }));
        controller.close();
        return;
      }

      let parsedJson: GeneratedCardJson;
      try {
        parsedJson = JSON.parse(rawContent) as GeneratedCardJson;
      } catch {
        controller.enqueue(sseEvent("error", { error: "ai_invalid_json" }));
        controller.close();
        return;
      }

      const card = parseGeneratedCard(parsedJson);

      const { data: insertedCard, error: insertError } = await supabase
        .from("user_generated_cards")
        .insert({
          user_id: userId,
          input_text: inputText,
          lang: "ja",
          topic_order: 1,
          ...card
        })
        .select("id, input_text, topic_title, genre, judgment_type, judgment_summary, action_text, deadline_at, threshold_json, watch_points_json, confidence_score, outcome, created_at")
        .single();

      if (insertError || !insertedCard) {
        controller.enqueue(sseEvent("error", { error: insertError?.message ?? "insert_failed" }));
        controller.close();
        return;
      }

      controller.enqueue(sseEvent("done", { card: insertedCard, remaining: remainingAfter }));
      controller.close();
    }
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive"
    }
  });
}

export async function GET() {
  const viewer = await getViewerFromCookies();
  if (!viewer) {
    return jsonResponse({ ok: false, error: "unauthorized" }, 401);
  }

  const supabase = createServiceRoleClient();

  const { data, error } = await supabase
    .from("user_generated_cards")
    .select("id, input_text, topic_title, genre, judgment_type, judgment_summary, action_text, deadline_at, threshold_json, watch_points_json, confidence_score, outcome, created_at")
    .eq("user_id", viewer.userId)
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) {
    return jsonResponse({ ok: false, error: error.message }, 500);
  }

  // Calculate remaining for today
  const dailyLimit = viewer.isPaid ? PAID_DAILY_LIMIT : FREE_DAILY_LIMIT;
  const startOfDay = todayStartJST();

  const { count } = await supabase
    .from("user_generated_cards")
    .select("id", { count: "exact", head: true })
    .eq("user_id", viewer.userId)
    .gte("created_at", startOfDay);

  const remaining = Math.max(0, dailyLimit - (count ?? 0));

  return jsonResponse({ ok: true, cards: data ?? [], remaining });
}
