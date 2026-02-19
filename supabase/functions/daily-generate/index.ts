import { failRun, finishRun, startRun } from "../_shared/jobRuns.ts";
import { jsonResponse } from "../_shared/http.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { parseCsvList } from "../_shared/trendsConfig.ts";
import { estimateScriptDurationSec, resolveScriptGateConfig } from "../_shared/scriptGate.ts";
import { normalizeScriptText } from "../_shared/scriptNormalize.ts";
import { checkScriptQuality } from "../_shared/scriptQualityCheck.ts";
import { buildSectionsCharsBreakdown } from "../_shared/scriptSections.ts";

type RequestBody = {
  episodeDate?: string;
  idempotencyKey?: string;
};

type InvokeResult = {
  ok?: boolean;
  [key: string]: unknown;
};

type TrendItem = {
  id?: string;
  title: string;
  url: string;
  summary: string;
  source: string;
  category: string;
  score?: number;
  publishedAt?: string | null;
};

type TrendCandidateRow = {
  title: string | null;
  url: string | null;
  summary: string | null;
  score: number | null;
  published_at: string | null;
  cluster_size: number | null;
  is_cluster_representative: boolean | null;
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

type SelectedTrendAuditItem = {
  id: string;
  title: string;
  category?: string;
  score: number;
  publishedAt: string | null;
  clusterSize: number | null;
};

type ScriptGateDiagnostic = {
  minChars: number;
  targetChars: number;
  maxChars: number;
  actualChars: number;
  estimatedSec: number;
  targetSec: number;
  rule: string;
};

type ScriptNormalizationAudit = {
  removedHtmlCount: number;
  removedUrlCount: number;
  dedupedLinesCount: number;
  changed: boolean;
};

const orderedSteps = [
  "plan-topics",
  "write-script-ja",
  "expand-script-ja",
  "tts-ja",
  "adapt-script-en",
  "tts-en",
  "publish"
] as const;

const MAX_TREND_ITEMS = 30;
const MAX_LETTERS = 2;
const MAX_LETTER_CANDIDATES = 20;
const MAX_LETTER_SUMMARY_CHARS = 80;
const MAX_EXPAND_ATTEMPTS = 2;

const TREND_MIX_TARGET = {
  hard: 4,
  soft: 4,
  entertainment: 3
} as const;

type TrendMixBucket = keyof typeof TREND_MIX_TARGET;

type TrendMixAudit = {
  target: typeof TREND_MIX_TARGET;
  selected: Record<TrendMixBucket, number>;
  achieved: boolean;
  usedFallbackItems: number;
};

const HARD_CATEGORIES = new Set([
  "news",
  "politics",
  "policy",
  "economy",
  "business",
  "science",
  "world"
]);

const ENTERTAINMENT_CATEGORIES = new Set([
  "entertainment",
  "culture",
  "sports",
  "music",
  "movie",
  "anime",
  "game",
  "gaming",
  "video",
  "youtube",
  "streaming",
  "celebrity"
]);

const DEFAULT_ENTERTAINMENT_BONUS = 0.45;

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
    source: "example.com",
    category: "soft"
  },
  {
    title: "Fallback: Reliability improvements",
    url: "https://example.com/fallback/reliability",
    summary: "Reliability and operations improvements were highlighted.",
    source: "example.com",
    category: "hard"
  },
  {
    title: "Fallback: User feedback highlights",
    url: "https://example.com/fallback/user-feedback",
    summary: "Recent user feedback showed recurring product requests.",
    source: "example.com",
    category: "entertainment"
  }
];

const fallbackByBucket: Record<TrendMixBucket, TrendItem> = {
  hard: {
    title: "Fallback hard topic: public policy and social impact",
    url: "https://example.com/fallback/hard",
    summary: "Policy and public impact context is added to keep the episode balanced.",
    source: "fallback-editorial",
    category: "hard"
  },
  soft: {
    title: "Fallback soft topic: product and user experience",
    url: "https://example.com/fallback/soft",
    summary: "Product and user-focused context is added to keep the episode balanced.",
    source: "fallback-editorial",
    category: "soft"
  },
  entertainment: {
    title: "Fallback entertainment topic: culture and lifestyle pulse",
    url: "https://example.com/fallback/entertainment",
    summary: "Culture and lifestyle context is added to keep the episode balanced.",
    source: "fallback-editorial",
    category: "entertainment"
  }
};

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

const normalizeToken = (value: string): string => {
  return value.trim().toLowerCase();
};

const resolveEntertainmentBonus = (): number => {
  const raw = Number.parseFloat(
    Deno.env.get("DAILY_ENTERTAINMENT_BONUS") ?? `${DEFAULT_ENTERTAINMENT_BONUS}`
  );
  if (!Number.isFinite(raw)) return DEFAULT_ENTERTAINMENT_BONUS;
  return Math.max(0, Math.min(raw, 3));
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

const resolveTrendBucket = (category: string): TrendMixBucket => {
  const normalized = normalizeToken(category);
  if (normalized === "hard") return "hard";
  if (normalized === "soft") return "soft";
  if (normalized === "entertainment") return "entertainment";
  if (HARD_CATEGORIES.has(normalized)) return "hard";
  if (ENTERTAINMENT_CATEGORIES.has(normalized)) return "entertainment";
  return "soft";
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
  const entertainmentBonus = resolveEntertainmentBonus();
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
    .select(
      "title, url, summary, score, published_at, cluster_size, is_cluster_representative, trend_sources!inner(name,category)"
    )
    .eq("is_cluster_representative", true)
    .gte("published_at", sinceIso)
    .order("score", { ascending: false })
    .order("published_at", { ascending: false })
    .limit(50);

  if (error) {
    throw error;
  }

  const trendItems = ((data ?? []) as TrendCandidateRow[])
    .filter((item) => Boolean(item.title && item.url && item.score !== null))
    .filter((item) => item.is_cluster_representative !== false)
    .filter((item) => {
      const category = normalizeToken(resolveCategory(item));
      if (excludedCategories.has(category)) {
        return false;
      }

      const haystack = `${item.title ?? ""} ${item.url ?? ""}`.toLowerCase();
      return !excludedKeywords.some((keyword) => haystack.includes(keyword));
    })
    .map((item) => {
      const category = resolveCategory(item);
      const normalizedCategory = normalizeToken(category);
      const rawScore = item.score as number;
      const bonus = ENTERTAINMENT_CATEGORIES.has(normalizedCategory) ? entertainmentBonus : 0;
      return {
        title: item.title as string,
        url: item.url as string,
        summary:
          (item.summary ?? "").trim() ||
          `${item.title as string} was highlighted in recent public reports and discussions.`,
        source: resolveSourceName(item),
        category,
        score: Number((rawScore + bonus).toFixed(6)),
        publishedAt: item.published_at
      } satisfies TrendItem;
    })
    .sort((left, right) => {
      const leftScore = left.score ?? 0;
      const rightScore = right.score ?? 0;
      if (rightScore !== leftScore) {
        return rightScore - leftScore;
      }
      return (right.publishedAt ?? "").localeCompare(left.publishedAt ?? "");
    });

  return trendItems.slice(0, MAX_TREND_ITEMS);
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

const selectTrendsForMix = (trendItems: TrendItem[]): { selected: TrendItem[]; audit: TrendMixAudit } => {
  const selected: TrendItem[] = [];
  const used = new Set<number>();
  const counts: Record<TrendMixBucket, number> = {
    hard: 0,
    soft: 0,
    entertainment: 0
  };
  let usedFallbackItems = 0;

  for (const bucket of Object.keys(TREND_MIX_TARGET) as TrendMixBucket[]) {
    const targetCount = TREND_MIX_TARGET[bucket];
    for (let i = 0; i < trendItems.length && counts[bucket] < targetCount; i += 1) {
      if (used.has(i)) continue;
      const item = trendItems[i];
      if (resolveTrendBucket(item.category) !== bucket) continue;
      selected.push(item);
      used.add(i);
      counts[bucket] += 1;
    }
  }

  for (const bucket of Object.keys(TREND_MIX_TARGET) as TrendMixBucket[]) {
    const targetCount = TREND_MIX_TARGET[bucket];
    while (counts[bucket] < targetCount) {
      const fallback = fallbackByBucket[bucket];
      selected.push({
        ...fallback,
        id: `fallback-${bucket}-${usedFallbackItems + 1}`
      });
      counts[bucket] += 1;
      usedFallbackItems += 1;
    }
  }

  const totalTarget = TREND_MIX_TARGET.hard + TREND_MIX_TARGET.soft + TREND_MIX_TARGET.entertainment;
  for (let i = 0; i < trendItems.length && selected.length < totalTarget; i += 1) {
    if (used.has(i)) continue;
    const item = trendItems[i];
    selected.push(item);
    used.add(i);
    counts[resolveTrendBucket(item.category)] += 1;
  }

  const achieved =
    counts.hard >= TREND_MIX_TARGET.hard &&
    counts.soft >= TREND_MIX_TARGET.soft &&
    counts.entertainment >= TREND_MIX_TARGET.entertainment;

  return {
    selected,
    audit: {
      target: TREND_MIX_TARGET,
      selected: counts,
      achieved,
      usedFallbackItems
    }
  };
};

const countEntertainmentTrends = (items: TrendItem[]): number => {
  return items.reduce((count, item) => {
    return resolveTrendBucket(item.category) === "entertainment" ? count + 1 : count;
  }, 0);
};

const extractEpisodeId = (stepResult: InvokeResult, stepName: string): string => {
  const id = typeof stepResult.episodeId === "string" ? stepResult.episodeId : "";
  if (!id) {
    throw new Error(`missing_episode_id:${stepName}`);
  }
  return id;
};

const assertNoUrlsInEpisodeScript = async (episodeId: string): Promise<void> => {
  const { data, error } = await supabaseAdmin
    .from("episodes")
    .select("script")
    .eq("id", episodeId)
    .single();

  if (error || !data) {
    throw error ?? new Error(`episode_not_found:${episodeId}`);
  }

  const script = typeof (data as { script?: string | null }).script === "string"
    ? ((data as { script?: string | null }).script as string)
    : "";
  if (/https?:\/\/|www\./i.test(script)) {
    throw new Error(`script_contains_url:${episodeId}`);
  }
};

const loadEpisodeScript = async (episodeId: string): Promise<string> => {
  const { data, error } = await supabaseAdmin
    .from("episodes")
    .select("script")
    .eq("id", episodeId)
    .single();

  if (error || !data) {
    throw error ?? new Error(`episode_not_found:${episodeId}`);
  }

  const script = typeof (data as { script?: string | null }).script === "string"
    ? ((data as { script?: string | null }).script as string)
    : "";

  return script;
};

const loadEpisodeScriptChars = async (episodeId: string): Promise<number> => {
  const script = await loadEpisodeScript(episodeId);
  return script.length;
};

const applyNormalizationToEpisodeScript = async (
  episodeId: string
): Promise<{
  script: string;
  scriptChars: number;
  metrics: ScriptNormalizationAudit;
}> => {
  const currentScript = await loadEpisodeScript(episodeId);
  const normalized = normalizeScriptText(currentScript);

  if (normalized.text !== currentScript) {
    const { error } = await supabaseAdmin
      .from("episodes")
      .update({ script: normalized.text })
      .eq("id", episodeId);

    if (error) {
      throw error;
    }
  }

  return {
    script: normalized.text,
    scriptChars: normalized.text.length,
    metrics: {
      removedHtmlCount: normalized.metrics.removedHtmlCount,
      removedUrlCount: normalized.metrics.removedUrlCount,
      dedupedLinesCount: normalized.metrics.dedupedLinesCount,
      changed: normalized.text !== currentScript
    }
  };
};

const toRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
};

const readNumberField = (source: InvokeResult, keys: string[]): number | null => {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return Math.max(0, Math.round(value));
    }
  }
  return null;
};

const readRecordField = (source: InvokeResult, key: string): Record<string, unknown> | null => {
  const value = source[key];
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
};

const readItemsUsedCount = (source: InvokeResult): Record<string, unknown> => {
  return readRecordField(source, "items_used_count") ?? {};
};

const readNormalizationMetric = (source: InvokeResult, key: string): number => {
  const value = source[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.round(value));
};

const readPlanTrendItems = (plan: InvokeResult): TrendItem[] => {
  const items = Array.isArray(plan.trendItems) ? plan.trendItems : [];

  return items
    .map((raw) => {
      const record = toRecord(raw);
      if (!record) return null;

      const title = typeof record.title === "string" ? record.title.trim() : "";
      if (!title) return null;

      const url = typeof record.url === "string" ? record.url.trim() : "";
      const summary = typeof record.summary === "string" ? record.summary.trim() : "";
      const source = typeof record.source === "string" ? record.source.trim() : "";
      const category = typeof record.category === "string" ? record.category.trim() : "";

      return {
        id: typeof record.id === "string" ? record.id : undefined,
        title,
        url,
        summary: summary || `${title} was highlighted in recent public reports and discussions.`,
        source: source || "unknown",
        category: category || "general",
        score: typeof record.score === "number" && Number.isFinite(record.score) ? record.score : undefined,
        publishedAt: typeof record.publishedAt === "string" ? record.publishedAt : null
      } satisfies TrendItem;
    })
    .filter((item): item is TrendItem => item !== null);
};

const readPlanSelectedTrendItems = (plan: InvokeResult): SelectedTrendAuditItem[] => {
  const items = Array.isArray(plan.selectedTrendItems) ? plan.selectedTrendItems : [];

  return items
    .map((raw) => {
      const record = toRecord(raw);
      if (!record) return null;

      const id = typeof record.id === "string" ? record.id.trim() : "";
      const title = typeof record.title === "string" ? record.title.trim() : "";
      const category = typeof record.category === "string" ? record.category.trim() : "";
      const score = typeof record.score === "number" && Number.isFinite(record.score) ? record.score : NaN;
      const publishedAt = typeof record.publishedAt === "string" ? record.publishedAt : null;
      const clusterSize =
        typeof record.clusterSize === "number" && Number.isFinite(record.clusterSize)
          ? record.clusterSize
          : null;

      if (!id || !title || Number.isNaN(score)) return null;

      return { id, title, category: category || undefined, score, publishedAt, clusterSize };
    })
    .filter((item): item is SelectedTrendAuditItem => item !== null);
};

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "method_not_allowed" }, 405);
  }

  const body = (await req.json().catch(() => ({}))) as RequestBody;
  const episodeDate = body.episodeDate ?? new Date().toISOString().slice(0, 10);
  const idempotencyKey = body.idempotencyKey ?? `daily-${episodeDate}`;
  const scriptGateConfig = resolveScriptGateConfig();

  const runId = await startRun("daily-generate", {
    step: "daily-generate",
    episodeDate,
    idempotencyKey,
    orderedSteps,
    scriptGate: scriptGateConfig
  });

  let failureDetails: Record<string, unknown> | null = null;

  try {
    const functionsBaseUrl = getFunctionsBaseUrl(req.url);
    const { trendItems: fallbackTrendCandidates, usedFallback: fallbackFromDaily } = await resolveTrendItems(
      functionsBaseUrl,
      episodeDate,
      idempotencyKey
    );
    const balancedTrends = selectTrendsForMix(fallbackTrendCandidates);
    const letterCandidates = await loadPrioritizedLetters().catch(() => []);
    const { letters, blockedIds } = await prepareLettersForScript(letterCandidates);

    const plan = await invokeStep(functionsBaseUrl, "plan-topics", {
      episodeDate,
      idempotencyKey,
      trendCandidates: balancedTrends.selected
    });
    const plannedTrendItems = readPlanTrendItems(plan);
    const selectedTrendItems = readPlanSelectedTrendItems(plan);
    const trendItems = plannedTrendItems.length > 0 ? plannedTrendItems : balancedTrends.selected;
    const entertainmentCount = countEntertainmentTrends(trendItems);
    if (entertainmentCount < TREND_MIX_TARGET.entertainment) {
      throw new Error(`insufficient_entertainment_topics:${entertainmentCount}`);
    }
    const usedTrendFallback =
      typeof plan.usedTrendFallback === "boolean" ? plan.usedTrendFallback : fallbackFromDaily;
    const trendFallbackReason =
      typeof plan.trendFallbackReason === "string" ? plan.trendFallbackReason : null;
    const planProgramPlan =
      plan.programPlan && typeof plan.programPlan === "object" && !Array.isArray(plan.programPlan)
        ? plan.programPlan
        : undefined;

    const writeJa = await invokeStep(functionsBaseUrl, "write-script-ja", {
      episodeDate,
      idempotencyKey,
      topic: plan.topic,
      programPlan: planProgramPlan,
      trendItems,
      letters
    });
    const writeJaEpisodeId = extractEpisodeId(writeJa, "write-script-ja");
    let normalizationAudit: ScriptNormalizationAudit = {
      removedHtmlCount: readNormalizationMetric(writeJa, "removed_html_count"),
      removedUrlCount: readNormalizationMetric(writeJa, "removed_url_count"),
      dedupedLinesCount: readNormalizationMetric(writeJa, "deduped_lines_count"),
      changed: false
    };
    const expandJaAttempts: InvokeResult[] = [];
    let actualChars =
      readNumberField(writeJa, ["chars_actual", "scriptChars"]) ??
      await loadEpisodeScriptChars(writeJaEpisodeId);
    let estimatedDurationSec =
      readNumberField(writeJa, ["estimatedDurationSec"]) ??
      estimateScriptDurationSec(actualChars, scriptGateConfig.charsPerMin);
    let sectionsCharsBreakdown = readRecordField(writeJa, "sections_chars_breakdown") ?? {};
    let itemsUsedCount = readItemsUsedCount(writeJa);
    let expandAttempted = 0;

    while (actualChars < scriptGateConfig.minChars && expandAttempted < MAX_EXPAND_ATTEMPTS) {
      expandAttempted += 1;
      const expanded = await invokeStep(functionsBaseUrl, "expand-script-ja", {
        episodeDate,
        idempotencyKey,
        episodeId: writeJaEpisodeId,
        attempt: expandAttempted,
        charsShortage: scriptGateConfig.minChars - actualChars
      });
      expandJaAttempts.push(expanded);
      actualChars =
        readNumberField(expanded, ["chars_actual", "scriptChars"]) ??
        await loadEpisodeScriptChars(writeJaEpisodeId);
      estimatedDurationSec =
        readNumberField(expanded, ["estimatedDurationSec"]) ??
        estimateScriptDurationSec(actualChars, scriptGateConfig.charsPerMin);
      sectionsCharsBreakdown = readRecordField(expanded, "sections_chars_breakdown") ?? sectionsCharsBreakdown;
      const expandedItemsUsed = readItemsUsedCount(expanded);
      if (Object.keys(expandedItemsUsed).length > 0) {
        itemsUsedCount = expandedItemsUsed;
      }
    }

    const normalizedJaScript = await applyNormalizationToEpisodeScript(writeJaEpisodeId);
    normalizationAudit = {
      removedHtmlCount: normalizationAudit.removedHtmlCount + normalizedJaScript.metrics.removedHtmlCount,
      removedUrlCount: normalizationAudit.removedUrlCount + normalizedJaScript.metrics.removedUrlCount,
      dedupedLinesCount: normalizationAudit.dedupedLinesCount + normalizedJaScript.metrics.dedupedLinesCount,
      changed: normalizationAudit.changed || normalizedJaScript.metrics.changed
    };
    actualChars = normalizedJaScript.scriptChars;
    estimatedDurationSec = estimateScriptDurationSec(actualChars, scriptGateConfig.charsPerMin);
    sectionsCharsBreakdown = buildSectionsCharsBreakdown(normalizedJaScript.script);
    const jaQuality = checkScriptQuality(normalizedJaScript.script);

    const scriptGateDiagnostic: ScriptGateDiagnostic = {
      minChars: scriptGateConfig.minChars,
      targetChars: scriptGateConfig.targetChars,
      maxChars: scriptGateConfig.maxChars,
      actualChars,
      estimatedSec: estimatedDurationSec,
      targetSec: scriptGateConfig.targetSec,
      rule: scriptGateConfig.rule
    };
    const scriptMetrics = {
      chars_ja: actualChars,
      chars_actual: actualChars,
      chars_min: scriptGateConfig.minChars,
      chars_target: scriptGateConfig.targetChars,
      chars_max: scriptGateConfig.maxChars,
      sections_chars_breakdown: sectionsCharsBreakdown,
      expand_attempted: expandAttempted,
      items_used_count: itemsUsedCount,
      removed_html_count: normalizationAudit.removedHtmlCount,
      removed_url_count: normalizationAudit.removedUrlCount,
      deduped_lines_count: normalizationAudit.dedupedLinesCount,
      normalization_changed: normalizationAudit.changed,
      quality: {
        duplicate_ratio: Number(jaQuality.metrics.duplicateRatio.toFixed(4)),
        duplicate_line_count: jaQuality.metrics.duplicateLineCount,
        char_length: jaQuality.metrics.charLength,
        violations: jaQuality.violations
      }
    };
    if (actualChars < scriptGateConfig.minChars) {
      failureDetails = {
        failedStep: "write-script-ja",
        scriptGate: scriptGateDiagnostic,
        scriptMetrics
      };
      throw new Error("script_too_short");
    }
    if (actualChars > scriptGateConfig.maxChars) {
      failureDetails = {
        failedStep: "write-script-ja",
        scriptGate: scriptGateDiagnostic,
        scriptMetrics
      };
      throw new Error("script_too_long");
    }
    if (!jaQuality.ok) {
      failureDetails = {
        failedStep: "write-script-ja",
        scriptGate: scriptGateDiagnostic,
        scriptMetrics
      };
      throw new Error(`script_quality_failed:${jaQuality.violations.join(",")}`);
    }
    await assertNoUrlsInEpisodeScript(writeJaEpisodeId);

    const ttsJa = await invokeStep(functionsBaseUrl, "tts-ja", {
      episodeDate,
      idempotencyKey,
      episodeId: writeJaEpisodeId
    });

    const adaptEn = await invokeStep(functionsBaseUrl, "adapt-script-en", {
      episodeDate,
      idempotencyKey,
      masterEpisodeId: writeJaEpisodeId
    });
    const adaptEnEpisodeId = extractEpisodeId(adaptEn, "adapt-script-en");
    await assertNoUrlsInEpisodeScript(adaptEnEpisodeId);

    const ttsEn = await invokeStep(functionsBaseUrl, "tts-en", {
      episodeDate,
      idempotencyKey,
      episodeId: adaptEnEpisodeId
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
      usedTrendFallback,
      trendFallbackReason,
      trendMix: balancedTrends.audit,
      entertainmentTopicCount: entertainmentCount,
      selectedTrendItems,
      scriptMetrics,
      estimatedDurationSec,
      scriptGate: {
        ...scriptGateDiagnostic,
        targetSecSource: scriptGateConfig.targetSecSource
      },
      outputs: {
        plan,
        writeJa,
        expandJa: expandJaAttempts,
        ttsJa,
        adaptEn,
        ttsEn,
        publish
      }
    });

    return jsonResponse({
      ok: true,
      runId,
      episodeDate,
      idempotencyKey,
      trendItems,
      lettersCount: letters.length,
      usedLetterIds: letters.map((letter) => letter.id),
      blockedLetterIds: blockedIds,
      usedTrendFallback,
      trendFallbackReason,
      trendMix: balancedTrends.audit,
      entertainmentTopicCount: entertainmentCount,
      selectedTrendItems,
      scriptMetrics,
      estimatedDurationSec,
      scriptGate: {
        ...scriptGateDiagnostic,
        targetSecSource: scriptGateConfig.targetSecSource
      },
      outputs: {
        plan,
        writeJa,
        expandJa: expandJaAttempts,
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
      orderedSteps,
      scriptGate: scriptGateConfig,
      ...(failureDetails ?? {})
    });

    return jsonResponse({
      ok: false,
      error: message,
      runId,
      ...(failureDetails ? { details: failureDetails } : {})
    }, 500);
  }
});
