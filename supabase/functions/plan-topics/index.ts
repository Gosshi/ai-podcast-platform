import { failRun, finishRun, startRun } from "../_shared/jobRuns.ts";
import { jsonResponse } from "../_shared/http.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { parseCsvList } from "../_shared/trendsConfig.ts";

type RequestBody = {
  episodeDate?: string;
  idempotencyKey?: string;
};

type TrendCandidateRow = {
  id: string | null;
  title: string | null;
  url: string | null;
  summary: string | null;
  score: number | null;
  published_at: string | null;
  cluster_size: number | null;
  is_cluster_representative: boolean | null;
  created_at: string | null;
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

type PlannedTrendItem = {
  id: string;
  title: string;
  url: string;
  summary: string;
  source: string;
  score: number;
  publishedAt: string | null;
  clusterSize: number;
};

type Topic = {
  title: string;
  bullets: string[];
};

const MIN_LOOKBACK_HOURS = 24;
const MAX_LOOKBACK_HOURS = 48;
const DEFAULT_LOOKBACK_HOURS = 36;
const MIN_TOP_N = 3;
const MAX_TOP_N = 5;
const DEFAULT_TOP_N = 5;
const MIN_TREND_BULLETS = 3;
const MAX_TREND_BULLETS = 5;

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

const fallbackTopic = (episodeDate: string): Topic => ({
  title: `Daily Topic ${episodeDate}`,
  bullets: [
    "トレンド要約1: 公開情報の更新を確認中です。",
    "トレンド要約2: 継続観測が必要な論点を整理します。",
    "トレンド要約3: 主要トピックの背景を短く振り返ります。",
    "お便りコーナー: リスナーのお便りを紹介します。",
    "次回予告: 次回の深掘り候補を案内します。"
  ]
});

const fallbackTrendItems = [
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
] as const;

const normalizeToken = (value: string): string => value.trim().toLowerCase();

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

const clamp = (value: number, min: number, max: number): number => {
  return Math.max(min, Math.min(max, value));
};

const resolveLookbackHours = (): number => {
  const raw = Number.parseInt(
    Deno.env.get("PLAN_TREND_LOOKBACK_HOURS") ??
      Deno.env.get("TREND_LOOKBACK_HOURS") ??
      `${DEFAULT_LOOKBACK_HOURS}`,
    10
  );

  if (!Number.isFinite(raw)) return DEFAULT_LOOKBACK_HOURS;
  return clamp(raw, MIN_LOOKBACK_HOURS, MAX_LOOKBACK_HOURS);
};

const resolveTopN = (): number => {
  const raw = Number.parseInt(
    Deno.env.get("PLAN_TREND_TOP_N") ?? `${DEFAULT_TOP_N}`,
    10
  );
  if (!Number.isFinite(raw)) return DEFAULT_TOP_N;
  return clamp(raw, MIN_TOP_N, MAX_TOP_N);
};

const compactText = (value: string): string => {
  return value.replace(/\s+/g, " ").trim();
};

const summarizeBullet = (value: string, maxChars = 80): string => {
  const compact = compactText(value);
  if (compact.length <= maxChars) return compact;
  return `${compact.slice(0, maxChars).trimEnd()}…`;
};

const loadSelectedTrends = async (
  lookbackHours: number,
  topN: number
): Promise<PlannedTrendItem[]> => {
  const sinceMs = Date.now() - lookbackHours * 60 * 60 * 1000;
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
      "id, title, url, summary, score, published_at, cluster_size, is_cluster_representative, created_at, trend_sources!inner(name,category)"
    )
    .eq("is_cluster_representative", true)
    .order("score", { ascending: false })
    .order("published_at", { ascending: false })
    .limit(200);

  if (error) throw error;

  const selected = ((data ?? []) as TrendCandidateRow[])
    .filter((row) => Boolean(row.id && row.title && row.url && row.score !== null))
    .filter((row) => row.is_cluster_representative !== false)
    .filter((row) => {
      const dateValue = row.published_at ?? row.created_at;
      if (!dateValue) return false;
      const rowMs = Date.parse(dateValue);
      if (Number.isNaN(rowMs) || rowMs < sinceMs) return false;

      const category = normalizeToken(resolveCategory(row));
      if (excludedCategories.has(category)) return false;

      const haystack = `${row.title ?? ""} ${row.summary ?? ""} ${row.url ?? ""}`.toLowerCase();
      return !excludedKeywords.some((keyword) => haystack.includes(keyword));
    })
    .map((row) => ({
      id: row.id as string,
      title: compactText(row.title as string),
      url: compactText(row.url as string),
      summary:
        compactText(row.summary ?? "") ||
        `${compactText(row.title as string)} was highlighted in recent public reports and discussions.`,
      source: resolveSourceName(row),
      score: row.score as number,
      publishedAt: row.published_at,
      clusterSize: Math.max(row.cluster_size ?? 1, 1)
    }))
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      if (right.clusterSize !== left.clusterSize) return right.clusterSize - left.clusterSize;
      return (right.publishedAt ?? "").localeCompare(left.publishedAt ?? "");
    });

  return selected.slice(0, topN);
};

const buildTopicFromTrends = (episodeDate: string, trendItems: PlannedTrendItem[]): Topic => {
  const main = trendItems[0];
  if (!main) {
    return fallbackTopic(episodeDate);
  }

  const subTitles = trendItems
    .slice(1, 3)
    .map((item) => summarizeBullet(item.title, 28))
    .filter((value) => value.length > 0);

  const title =
    subTitles.length > 0
      ? `${summarizeBullet(main.title, 40)} を軸に読む: ${subTitles.join(" / ")}`
      : `${summarizeBullet(main.title, 48)} の背景整理`;

  const trendBulletCount = clamp(trendItems.length, MIN_TREND_BULLETS, MAX_TREND_BULLETS);
  const trendBullets = Array.from({ length: trendBulletCount }, (_, index) => {
    const item = trendItems[Math.min(index, trendItems.length - 1)] ?? main;
    return `トレンド要約${index + 1}: ${summarizeBullet(item.title, 45)} - ${summarizeBullet(item.summary, 55)}`;
  });

  return {
    title,
    bullets: [
      ...trendBullets,
      "お便りコーナー: リスナーのお便りを紹介し、番組内で回答します。",
      "次回予告: 今日反応が大きかった論点を次回に深掘りします。"
    ]
  };
};

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "method_not_allowed" }, 405);
  }

  const body = (await req.json().catch(() => ({}))) as RequestBody;
  const episodeDate = body.episodeDate ?? new Date().toISOString().slice(0, 10);
  const idempotencyKey = body.idempotencyKey ?? `daily-${episodeDate}`;
  const lookbackHours = resolveLookbackHours();
  const topN = resolveTopN();

  const runId = await startRun("plan-topics", {
    step: "plan-topics",
    episodeDate,
    idempotencyKey,
    lookbackHours,
    topN
  });

  try {
    let selectedTrendItems: PlannedTrendItem[] = [];
    let usedTrendFallback = false;
    let trendFallbackReason: string | null = null;
    let trendLoadError: string | null = null;

    try {
      selectedTrendItems = await loadSelectedTrends(lookbackHours, topN);
      if (selectedTrendItems.length === 0) {
        usedTrendFallback = true;
        trendFallbackReason = "no_recent_trends";
      }
    } catch (error) {
      usedTrendFallback = true;
      trendFallbackReason = "trend_query_failed";
      trendLoadError = error instanceof Error ? error.message : String(error);
    }

    const topic = usedTrendFallback
      ? fallbackTopic(episodeDate)
      : buildTopicFromTrends(episodeDate, selectedTrendItems);
    const trendItemsForScript = usedTrendFallback
      ? [...fallbackTrendItems]
      : selectedTrendItems.map((item) => ({
          title: item.title,
          url: item.url,
          summary: item.summary,
          source: item.source
        }));
    const selectedTrendAudit = selectedTrendItems.map((item) => ({
      id: item.id,
      title: item.title,
      score: item.score,
      publishedAt: item.publishedAt,
      clusterSize: item.clusterSize
    }));

    await finishRun(runId, {
      step: "plan-topics",
      episodeDate,
      idempotencyKey,
      topic,
      lookbackHours,
      topN,
      usedTrendFallback,
      trendFallbackReason,
      trendLoadError,
      trendItems: trendItemsForScript,
      selectedTrendItems: selectedTrendAudit
    });

    return jsonResponse({
      ok: true,
      episodeDate,
      idempotencyKey,
      topic,
      usedTrendFallback,
      trendFallbackReason,
      trendItems: trendItemsForScript,
      selectedTrendItems: selectedTrendAudit
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await failRun(runId, message, {
      step: "plan-topics",
      episodeDate,
      idempotencyKey,
      lookbackHours,
      topN
    });

    return jsonResponse({ ok: false, error: message }, 500);
  }
});
