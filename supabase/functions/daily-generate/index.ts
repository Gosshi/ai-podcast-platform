import { failRun, finishRun, startRun } from "../_shared/jobRuns.ts";
import { jsonResponse } from "../_shared/http.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";

type RequestBody = {
  episodeDate?: string;
  idempotencyKey?: string;
};

type InvokeResult = {
  ok?: boolean;
  [key: string]: unknown;
};

type TrendItem = {
  title: string;
  url: string;
  summary: string;
  source: string;
};

type ScoredTrendItem = TrendItem & {
  score: number;
  publishedAt: string | null;
};

type TrendCandidateRow = {
  title: string | null;
  url: string | null;
  summary: string | null;
  score: number | null;
  published_at: string | null;
  trend_sources:
    | {
        category: string | null;
        name: string | null;
      }
    | {
        category: string | null;
        name: string | null;
      }[]
    | null;
};

type LetterItem = {
  id: string;
  display_name: string;
  text: string;
  tip_amount: number | null;
  tip_currency: string | null;
  tip_provider_payment_id: string | null;
};

type LetterRow = {
  id: string | null;
  display_name: string | null;
  text: string | null;
  moderation_status: string | null;
  is_used: boolean | null;
  is_blocked: boolean | null;
  blocked_reason: string | null;
  created_at: string | null;
};

type TipLetterJoinRow = {
  amount: number | null;
  currency: string | null;
  provider_payment_id: string | null;
  created_at: string | null;
  letter_id: string | null;
  letters:
    | {
        id: string | null;
        display_name: string | null;
        text: string | null;
        moderation_status: string | null;
        is_used: boolean | null;
        is_blocked: boolean | null;
        blocked_reason: string | null;
        created_at: string | null;
      }
    | {
        id: string | null;
        display_name: string | null;
        text: string | null;
        moderation_status: string | null;
        is_used: boolean | null;
        is_blocked: boolean | null;
        blocked_reason: string | null;
        created_at: string | null;
      }[]
    | null;
};

type ScriptModerationResult =
  | {
      ok: true;
      summary: string;
    }
  | {
      ok: false;
      reason: string;
    };

const orderedSteps = [
  "plan-topics",
  "write-script-ja",
  "tts-ja",
  "adapt-script-en",
  "tts-en",
  "publish"
] as const;

const MAX_TREND_ITEMS = 3;
const MAX_LETTERS = 2;
const MAX_LETTER_CANDIDATES = 20;
const MAX_LETTER_SUMMARY_CHARS = 80;

const DEFAULT_EXCLUDED_SOURCE_CATEGORIES = [
  "investment",
  "stocks",
  "fx",
  "crypto",
  "cryptocurrency",
  "finance"
];

const DEFAULT_EXCLUDED_KEYWORDS = [
  "投資",
  "株",
  "株式",
  "fx",
  "為替",
  "暗号資産",
  "仮想通貨",
  "crypto",
  "bitcoin",
  "btc",
  "eth"
];

const HARD_BLOCK_PATTERNS = [
  /死ね|殺す|ぶっ殺|消えろ/u,
  /fuck you|kill yourself|die\b/i,
  /(差別|見下し|侮辱).*(しろ|するべき|当然)/u
];

const MEDICAL_INVESTMENT_ASSERTION_PATTERNS = [
  /(絶対|必ず|確実|100%|guaranteed?).*(儲か|利益|勝て|上がる|下がる|投資|株|fx|crypto|bitcoin|btc|eth)/iu,
  /(投資|株|fx|crypto|bitcoin|btc|eth).*(絶対|必ず|確実|100%|guaranteed?)/iu,
  /(絶対|必ず|確実|100%|guaranteed?).*(治る|治せる|効く|完治|診断|薬|サプリ|病気|癌|がん)/iu,
  /(医療|治療|薬|サプリ).*(絶対|必ず|確実|100%|guaranteed?)/iu
];

const fallbackTrendItems: TrendItem[] = [
  {
    title: "Fallback: Product update cadence",
    url: "https://example.com/fallback/product-update",
    summary: "Product roadmap updates were shared in public channels.",
    source: "example.com"
  },
  {
    title: "Fallback: Reliability improvements",
    url: "https://example.com/fallback/reliability",
    summary: "Reliability and operations improvements were highlighted.",
    source: "example.com"
  },
  {
    title: "Fallback: User feedback highlights",
    url: "https://example.com/fallback/user-feedback",
    summary: "Recent user feedback showed recurring product requests.",
    source: "example.com"
  }
];

const getFunctionsBaseUrl = (requestUrl: string): string => {
  const explicit = Deno.env.get("FUNCTIONS_BASE_URL") ?? Deno.env.get("SUPABASE_FUNCTIONS_URL");
  if (explicit) return explicit;

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  if (supabaseUrl) {
    return `${supabaseUrl}/functions/v1`;
  }

  return `${new URL(requestUrl).origin}/functions/v1`;
};

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const invokeStep = async (
  functionsBaseUrl: string,
  step: string,
  payload: Record<string, unknown>
): Promise<InvokeResult> => {
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!serviceRole) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required");
  }

  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fetch(`${functionsBaseUrl}/${step}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${serviceRole}`
        },
        body: JSON.stringify(payload)
      });

      const body = (await response.json().catch(() => ({}))) as InvokeResult;
      if (response.ok && body.ok !== false) {
        return body;
      }

      const retryable = response.status >= 500 || response.status === 429;
      if (!retryable || attempt === maxAttempts) {
        throw new Error(`step_failed:${step}`);
      }
    } catch (error) {
      if (attempt === maxAttempts) {
        if (error instanceof Error && error.message.startsWith("step_failed:")) {
          throw error;
        }
        throw new Error(`step_failed:${step}`);
      }
    }

    await sleep(attempt * 150);
  }

  throw new Error(`step_failed:${step}`);
};

const parseCsvList = (rawValue: string | undefined, fallback: string[]): string[] => {
  if (!rawValue) return fallback;
  const values = rawValue
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
  return values.length > 0 ? values : fallback;
};

const normalizeToken = (value: string): string => {
  return value.trim().toLowerCase();
};

const resolveCategory = (row: TrendCandidateRow): string => {
  if (Array.isArray(row.trend_sources)) {
    return row.trend_sources[0]?.category ?? "general";
  }
  return row.trend_sources?.category ?? "general";
};

const resolveSourceName = (row: TrendCandidateRow): string => {
  if (Array.isArray(row.trend_sources)) {
    return row.trend_sources[0]?.name ?? "unknown";
  }
  return row.trend_sources?.name ?? "unknown";
};

const resolveHost = (url: string): string => {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return url.trim().toLowerCase();
  }
};

const normalizeTitle = (title: string): string => {
  return title
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
};

const tokenizeTitle = (title: string): Set<string> => {
  const normalized = normalizeTitle(title);
  if (!normalized) return new Set();
  return new Set(
    normalized
      .split(" ")
      .map((token) => token.trim())
      .filter((token) => token.length > 0)
  );
};

const jaccardSimilarity = (a: Set<string>, b: Set<string>): number => {
  if (a.size === 0 || b.size === 0) return 0;

  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) {
      intersection += 1;
    }
  }

  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
};

const pickHigherScore = (current: ScoredTrendItem, next: ScoredTrendItem): ScoredTrendItem => {
  if (next.score !== current.score) {
    return next.score > current.score ? next : current;
  }

  const nextPublished = next.publishedAt ?? "";
  const currentPublished = current.publishedAt ?? "";
  return nextPublished > currentPublished ? next : current;
};

const clusterTrendItems = (items: ScoredTrendItem[]): TrendItem[] => {
  const byHost = new Map<string, ScoredTrendItem>();
  for (const item of items) {
    const host = resolveHost(item.url);
    const existing = byHost.get(host);
    if (!existing) {
      byHost.set(host, item);
      continue;
    }
    byHost.set(host, pickHigherScore(existing, item));
  }

  const hostDeduped = Array.from(byHost.values()).sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return (b.publishedAt ?? "").localeCompare(a.publishedAt ?? "");
  });

  const clusters: { representative: ScoredTrendItem; representativeTokens: Set<string> }[] = [];
  for (const item of hostDeduped) {
    const tokens = tokenizeTitle(item.title);
    const matchedCluster = clusters.find(
      (cluster) => jaccardSimilarity(tokens, cluster.representativeTokens) >= 0.6
    );

    if (!matchedCluster) {
      clusters.push({ representative: item, representativeTokens: tokens });
    }
  }

  return clusters.slice(0, MAX_TREND_ITEMS).map((cluster) => ({
    title: cluster.representative.title,
    url: cluster.representative.url,
    summary: cluster.representative.summary,
    source: cluster.representative.source
  }));
};

const sanitizeNarrationText = (value: string): string => {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/&#45;/g, "-")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
};

const splitSentences = (value: string): string[] => {
  return value
    .split(/(?<=[。.!?！？])\s+/u)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
};

const summarizeLetterText = (value: string): string => {
  if (value.length <= MAX_LETTER_SUMMARY_CHARS) {
    return value;
  }
  return `${value.slice(0, MAX_LETTER_SUMMARY_CHARS).trimEnd()}…`;
};

const moderateLetterForScript = (rawText: string): ScriptModerationResult => {
  const sanitized = sanitizeNarrationText(rawText);
  if (!sanitized) {
    return { ok: false, reason: "empty_after_sanitize" };
  }

  if (HARD_BLOCK_PATTERNS.some((pattern) => pattern.test(sanitized))) {
    return { ok: false, reason: "contains_attack_or_discrimination" };
  }

  const safeSentences = splitSentences(sanitized).filter(
    (sentence) => !MEDICAL_INVESTMENT_ASSERTION_PATTERNS.some((pattern) => pattern.test(sentence))
  );
  if (safeSentences.length === 0) {
    return { ok: false, reason: "contains_only_assertive_medical_or_investment_claims" };
  }

  const toneAdjusted = safeSentences
    .join(" ")
    .replace(/[!！]{2,}/g, "！")
    .replace(/[?？]{2,}/g, "？")
    .replace(/\s+/g, " ")
    .trim();
  if (!toneAdjusted) {
    return { ok: false, reason: "empty_after_tone_adjustment" };
  }

  return { ok: true, summary: summarizeLetterText(toneAdjusted) };
};

const loadTopTrends = async (): Promise<TrendItem[]> => {
  const sinceIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const excludedCategories = new Set(
    parseCsvList(
      Deno.env.get("TREND_EXCLUDED_CATEGORIES") ?? undefined,
      DEFAULT_EXCLUDED_SOURCE_CATEGORIES
    ).map(normalizeToken)
  );
  const excludedKeywords = parseCsvList(
    Deno.env.get("TREND_EXCLUDED_KEYWORDS") ?? undefined,
    DEFAULT_EXCLUDED_KEYWORDS
  ).map(normalizeToken);

  const { data, error } = await supabaseAdmin
    .from("trend_items")
    .select("title, url, summary, score, published_at, trend_sources!inner(name,category)")
    .gte("published_at", sinceIso)
    .order("score", { ascending: false })
    .order("published_at", { ascending: false })
    .limit(50);

  if (error) {
    throw error;
  }

  const trendItems = ((data ?? []) as TrendCandidateRow[])
    .filter((item) => Boolean(item.title && item.url && item.score !== null))
    .filter((item) => {
      const category = normalizeToken(resolveCategory(item));
      if (excludedCategories.has(category)) {
        return false;
      }

      const haystack = `${item.title ?? ""} ${item.url ?? ""}`.toLowerCase();
      return !excludedKeywords.some((keyword) => haystack.includes(keyword));
    })
    .map((item) => ({
      title: item.title as string,
      url: item.url as string,
      summary:
        (item.summary ?? "").trim() ||
        `${item.title as string} was highlighted in recent public reports and discussions.`,
      source: resolveSourceName(item),
      score: item.score as number,
      publishedAt: item.published_at
    }));

  return clusterTrendItems(trendItems);
};

const resolveJoinedLetterRow = (
  row: TipLetterJoinRow
): {
  id: string | null;
  display_name: string | null;
  text: string | null;
  moderation_status: string | null;
  is_used: boolean | null;
  is_blocked: boolean | null;
  blocked_reason: string | null;
  created_at: string | null;
} | null => {
  if (!row.letters) return null;
  if (Array.isArray(row.letters)) {
    return row.letters[0] ?? null;
  }
  return row.letters;
};

const loadPrioritizedLetters = async (): Promise<LetterItem[]> => {
  const { data: tipData, error: tipError } = await supabaseAdmin
    .from("tips")
    .select(
      "amount, currency, provider_payment_id, created_at, letter_id, letters!inner(id, display_name, text, moderation_status, is_used, is_blocked, blocked_reason, created_at)"
    )
    .not("letter_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(50);

  if (tipError) {
    throw tipError;
  }

  const tipFirstMap = new Map<string, LetterItem>();
  for (const row of (tipData ?? []) as TipLetterJoinRow[]) {
    const letter = resolveJoinedLetterRow(row);
    if (!letter?.id || !letter.display_name || !letter.text) {
      continue;
    }
    if (
      letter.is_used === true ||
      letter.moderation_status === "reject" ||
      letter.is_blocked === true
    ) {
      continue;
    }
    if (tipFirstMap.has(letter.id)) {
      continue;
    }

    tipFirstMap.set(letter.id, {
      id: letter.id,
      display_name: letter.display_name,
      text: letter.text,
      tip_amount: row.amount,
      tip_currency: row.currency,
      tip_provider_payment_id: row.provider_payment_id,
    });
  }

  const { data, error } = await supabaseAdmin
    .from("letters")
    .select("id, display_name, text, moderation_status, is_used, is_blocked, blocked_reason, created_at")
    .eq("is_used", false)
    .eq("is_blocked", false)
    .neq("moderation_status", "reject")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    throw error;
  }

  const unreadRows = ((data ?? []) as LetterRow[]).filter(
    (row) =>
      Boolean(row.id && row.display_name && row.text) &&
      row.is_used !== true &&
      row.is_blocked !== true
  );

  const result: LetterItem[] = [];
  const usedIds = new Set<string>();

  for (const letter of tipFirstMap.values()) {
    if (result.length >= MAX_LETTER_CANDIDATES) break;
    result.push(letter);
    usedIds.add(letter.id);
  }

  for (const row of unreadRows) {
    if (result.length >= MAX_LETTER_CANDIDATES) break;
    const id = row.id as string;
    if (usedIds.has(id)) continue;
    result.push({
      id,
      display_name: row.display_name as string,
      text: row.text as string,
      tip_amount: null,
      tip_currency: null,
      tip_provider_payment_id: null
    });
    usedIds.add(id);
  }

  return result;
};

const markLettersAsBlocked = async (
  blockedLetters: { id: string; reason: string }[]
): Promise<void> => {
  for (const blocked of blockedLetters) {
    const { error } = await supabaseAdmin
      .from("letters")
      .update({
        is_blocked: true,
        blocked_reason: blocked.reason,
        moderation_status: "reject"
      })
      .eq("id", blocked.id)
      .eq("is_used", false);

    if (error) {
      throw error;
    }
  }
};

const prepareLettersForScript = async (
  letters: LetterItem[]
): Promise<{ letters: LetterItem[]; blockedIds: string[] }> => {
  const acceptedLetters: LetterItem[] = [];
  const blockedLetters: { id: string; reason: string }[] = [];

  for (const letter of letters) {
    const result = moderateLetterForScript(letter.text);
    if (!result.ok) {
      blockedLetters.push({ id: letter.id, reason: result.reason });
      continue;
    }

    if (acceptedLetters.length < MAX_LETTERS) {
      acceptedLetters.push({
        ...letter,
        text: result.summary
      });
    }
  }

  if (blockedLetters.length > 0) {
    await markLettersAsBlocked(blockedLetters);
  }

  return {
    letters: acceptedLetters,
    blockedIds: blockedLetters.map((letter) => letter.id)
  };
};

const markLettersAsUsed = async (letters: LetterItem[]): Promise<void> => {
  const letterIds = letters.map((letter) => letter.id);
  if (letterIds.length === 0) {
    return;
  }

  const { error } = await supabaseAdmin
    .from("letters")
    .update({ is_used: true })
    .in("id", letterIds)
    .eq("is_used", false);

  if (error) {
    throw error;
  }
};

const resolveTrendItems = async (
  functionsBaseUrl: string,
  episodeDate: string,
  idempotencyKey: string
): Promise<{ trendItems: TrendItem[]; usedFallback: boolean }> => {
  try {
    await invokeStep(functionsBaseUrl, "ingest_trends_rss", {
      episodeDate,
      idempotencyKey
    });

    const trendItems = await loadTopTrends();
    if (trendItems.length === 0) {
      return { trendItems: fallbackTrendItems, usedFallback: true };
    }

    return { trendItems, usedFallback: false };
  } catch {
    return { trendItems: fallbackTrendItems, usedFallback: true };
  }
};

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "method_not_allowed" }, 405);
  }

  const body = (await req.json().catch(() => ({}))) as RequestBody;
  const episodeDate = body.episodeDate ?? new Date().toISOString().slice(0, 10);
  const idempotencyKey = body.idempotencyKey ?? `daily-${episodeDate}`;

  const runId = await startRun("daily-generate", {
    step: "daily-generate",
    episodeDate,
    idempotencyKey,
    orderedSteps
  });

  try {
    const functionsBaseUrl = getFunctionsBaseUrl(req.url);
    const { trendItems, usedFallback } = await resolveTrendItems(
      functionsBaseUrl,
      episodeDate,
      idempotencyKey
    );
    const letterCandidates = await loadPrioritizedLetters().catch(() => []);
    const { letters, blockedIds } = await prepareLettersForScript(letterCandidates);

    const plan = await invokeStep(functionsBaseUrl, "plan-topics", { episodeDate, idempotencyKey });

    const writeJa = await invokeStep(functionsBaseUrl, "write-script-ja", {
      episodeDate,
      idempotencyKey,
      topic: plan.topic,
      trendItems,
      letters
    });

    const ttsJa = await invokeStep(functionsBaseUrl, "tts-ja", {
      episodeDate,
      idempotencyKey,
      episodeId: writeJa.episodeId
    });

    const adaptEn = await invokeStep(functionsBaseUrl, "adapt-script-en", {
      episodeDate,
      idempotencyKey,
      masterEpisodeId: writeJa.episodeId
    });

    const ttsEn = await invokeStep(functionsBaseUrl, "tts-en", {
      episodeDate,
      idempotencyKey,
      episodeId: adaptEn.episodeId
    });

    const publish = await invokeStep(functionsBaseUrl, "publish", {
      episodeDate,
      idempotencyKey,
      episodeIdJa: ttsJa.episodeId,
      episodeIdEn: ttsEn.episodeId
    });

    await markLettersAsUsed(letters);

    await finishRun(runId, {
      step: "daily-generate",
      episodeDate,
      idempotencyKey,
      orderedSteps,
      trendItems,
      lettersCount: letters.length,
      usedLetterIds: letters.map((letter) => letter.id),
      blockedLetterIds: blockedIds,
      usedTrendFallback: usedFallback,
      outputs: {
        plan,
        writeJa,
        ttsJa,
        adaptEn,
        ttsEn,
        publish
      }
    });

    return jsonResponse({
      ok: true,
      episodeDate,
      idempotencyKey,
      trendItems,
      lettersCount: letters.length,
      usedLetterIds: letters.map((letter) => letter.id),
      blockedLetterIds: blockedIds,
      usedTrendFallback: usedFallback,
      outputs: {
        plan,
        writeJa,
        ttsJa,
        adaptEn,
        ttsEn,
        publish
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await failRun(runId, message, {
      step: "daily-generate",
      episodeDate,
      idempotencyKey,
      orderedSteps
    });

    return jsonResponse({ ok: false, error: message }, 500);
  }
});
