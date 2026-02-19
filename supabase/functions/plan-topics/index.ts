import { failRun, finishRun, startRun } from "../_shared/jobRuns.ts";
import { jsonResponse } from "../_shared/http.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { parseCsvList } from "../_shared/trendsConfig.ts";
import {
  buildTrendDigest,
  resolveTrendDigestConfigFromRaw,
  type TrendDigestItem,
  type TrendDigestSourceItem
} from "../_shared/trendDigest.ts";
import {
  PROGRAM_MAIN_TOPICS_COUNT,
  PROGRAM_QUICK_NEWS_COUNT,
  PROGRAM_SMALL_TALK_COUNT,
  type ProgramPlan
} from "../_shared/programPlan.ts";

type RequestBody = {
  episodeDate?: string;
  idempotencyKey?: string;
  trendCandidates?: {
    id?: string;
    title?: string;
    url?: string;
    summary?: string;
    source?: string;
    category?: string;
    score?: number;
    publishedAt?: string | null;
    clusterSize?: number;
  }[];
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
  category: string;
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
const MIN_TOP_N = 9;
const MAX_TOP_N = 20;
const DEFAULT_TOP_N = 10;

const PROGRAM_REQUIRED_TRENDS =
  PROGRAM_MAIN_TOPICS_COUNT + PROGRAM_QUICK_NEWS_COUNT + PROGRAM_SMALL_TALK_COUNT;

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

const fallbackTrendItems: PlannedTrendItem[] = [
  {
    id: "fallback-main-1",
    title: "Fallback: Public policy update",
    url: "https://example.com/fallback/policy",
    summary: "Policy and governance updates were discussed in major media.",
    source: "example.com",
    category: "news",
    score: 1,
    publishedAt: null,
    clusterSize: 1
  },
  {
    id: "fallback-main-2",
    title: "Fallback: Technology product move",
    url: "https://example.com/fallback/product",
    summary: "A technology product roadmap update triggered broad discussion.",
    source: "example.com",
    category: "tech",
    score: 1,
    publishedAt: null,
    clusterSize: 1
  },
  {
    id: "fallback-main-3",
    title: "Fallback: Consumer trend signal",
    url: "https://example.com/fallback/consumer",
    summary: "Consumer behavior changes appeared in multiple public reports.",
    source: "example.com",
    category: "lifestyle",
    score: 1,
    publishedAt: null,
    clusterSize: 1
  }
];

const normalizeToken = (value: string): string => value.trim().toLowerCase();

const compactText = (value: string): string => {
  return value.replace(/\s+/g, " ").trim();
};

const summarizeText = (value: string, maxChars: number): string => {
  const normalized = compactText(value);
  if (normalized.length <= maxChars) return normalized;
  return `${normalized.slice(0, maxChars).trimEnd()}…`;
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
  const raw = Number.parseInt(Deno.env.get("PLAN_TREND_TOP_N") ?? `${DEFAULT_TOP_N}`, 10);
  if (!Number.isFinite(raw)) return DEFAULT_TOP_N;
  return clamp(raw, MIN_TOP_N, MAX_TOP_N);
};

const normalizeProvidedTrends = (
  trendCandidates: RequestBody["trendCandidates"]
): PlannedTrendItem[] => {
  return (trendCandidates ?? [])
    .map((item, index) => {
      const title = compactText(item?.title ?? "");
      if (!title) return null;

      const summary =
        compactText(item?.summary ?? "") ||
        `${title} was highlighted in recent public reports and discussions.`;
      const url = compactText(item?.url ?? "");
      return {
        id: compactText(item?.id ?? "") || `provided-${index + 1}`,
        title,
        url,
        summary,
        source: compactText(item?.source ?? "") || "unknown",
        category: compactText(item?.category ?? "") || "general",
        score: typeof item?.score === "number" && Number.isFinite(item.score) ? item.score : 0,
        publishedAt: typeof item?.publishedAt === "string" ? item.publishedAt : null,
        clusterSize:
          typeof item?.clusterSize === "number" && Number.isFinite(item.clusterSize)
            ? Math.max(1, Math.floor(item.clusterSize))
            : 1
      } satisfies PlannedTrendItem;
    })
    .filter((item): item is PlannedTrendItem => item !== null);
};

const toDigestSourceItems = (items: PlannedTrendItem[]): TrendDigestSourceItem[] => {
  return items.map((item) => ({
    id: item.id,
    title: item.title,
    summary: item.summary,
    source: item.source,
    url: item.url,
    category: item.category || "general",
    score: item.score,
    publishedAt: item.publishedAt,
    clusterSize: item.clusterSize
  }));
};

const toPlannedFromDigestItem = (item: TrendDigestItem): PlannedTrendItem => {
  return {
    id: item.id,
    title: item.cleanedTitle,
    url: item.url,
    summary: `${item.whatHappened} ${item.whyItMatters}`.trim(),
    source: item.source,
    category: item.category || "general",
    score: item.score,
    publishedAt: item.publishedAt,
    clusterSize: item.clusterSize
  };
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
    .limit(250);

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
      category: compactText(resolveCategory(row)),
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

const withFallbackTrends = (items: PlannedTrendItem[]): PlannedTrendItem[] => {
  if (items.length >= PROGRAM_REQUIRED_TRENDS) return items;

  const expanded = [...items];
  let fallbackIndex = 0;
  while (expanded.length < PROGRAM_REQUIRED_TRENDS) {
    const fallback = fallbackTrendItems[fallbackIndex % fallbackTrendItems.length];
    expanded.push({
      ...fallback,
      id: `${fallback.id}-${fallbackIndex + 1}`
    });
    fallbackIndex += 1;
  }
  return expanded;
};

const buildProgramPlan = (episodeDate: string, trendItems: PlannedTrendItem[]): ProgramPlan => {
  const pool = withFallbackTrends(trendItems);
  const mainItems = pool.slice(0, PROGRAM_MAIN_TOPICS_COUNT);
  const quickNewsItems = pool.slice(
    PROGRAM_MAIN_TOPICS_COUNT,
    PROGRAM_MAIN_TOPICS_COUNT + PROGRAM_QUICK_NEWS_COUNT
  );
  const smallTalkItems = pool.slice(
    PROGRAM_MAIN_TOPICS_COUNT + PROGRAM_QUICK_NEWS_COUNT,
    PROGRAM_MAIN_TOPICS_COUNT + PROGRAM_QUICK_NEWS_COUNT + PROGRAM_SMALL_TALK_COUNT
  );

  return {
    role: "editor-in-chief",
    main_topics: mainItems.map((item, index) => ({
      title: item.title,
      source: item.source,
      category: item.category || "general",
      intro: `${index + 1}本目のメイントピックです。${item.title}を起点に、今日の論点を短期と中期の両方で整理します。`,
      background: `背景としては、${summarizeText(item.summary, 180)}。一次情報では、関係者の発言と公開資料の更新タイミングが噛み合い、短期間で注目が拡大しました。`,
      impact: `影響は実務面と生活面の両方に及びます。政策・プロダクト・利用者行動のどこに変化圧力がかかるのかを分解し、判断を急ぎすぎない姿勢で整理します。`,
      supplement: `補足として、出典カテゴリは「${item.category || "general"}」、主な参照媒体は「${item.source}」です。断定よりも比較で理解するため、類似事例と反証可能性も併せて確認します。`
    })),
    quick_news: quickNewsItems.map((item) => ({
      title: item.title,
      source: item.source,
      category: item.category || "general",
      summary: summarizeText(item.summary, 120),
      durationSecTarget: 30
    })),
    small_talk: smallTalkItems.map((item, index) => ({
      title: item.title,
      mood: index % 2 === 0 ? "calm" : "light",
      talkingPoint: `${item.title}をきっかけに、リスナーの体験に引き寄せて短く会話します。${summarizeText(item.summary, 80)}`
    })),
    letters: {
      host_prompt:
        "お便りは結論を急がず、共感と次の行動が両立する返答を優先します。個別助言は避け、番組全体に有益な学びへ要約します。"
    },
    ending: {
      message: `${episodeDate}回の締めです。重要論点の再確認と、次回の深掘り予告を一言で提示して終わります。`
    }
  };
};

const buildCompatTopic = (
  episodeDate: string,
  programPlan: ProgramPlan,
  digestItems: TrendDigestItem[]
): Topic => {
  const digestTitle = digestItems
    .slice(0, 2)
    .map((item) => summarizeText(item.cleanedTitle, 26))
    .join(" / ");
  const mainTitles = programPlan.main_topics.map((item) => summarizeText(item.title, 28)).join(" / ");
  const quickNewsTitles = digestItems
    .slice(0, 2)
    .map((item, index) => `クイック${index + 1}: ${summarizeText(item.cleanedTitle, 26)}`);
  const digestBullets = digestItems
    .slice(0, 3)
    .map(
      (item, index) =>
        `メイントピック${index + 1}: ${summarizeText(item.cleanedTitle, 42)} / ${summarizeText(item.whyItMatters, 42)}`
    );

  return {
    title: digestTitle || mainTitles || `Daily Topic ${episodeDate}`,
    bullets: [
      ...(digestBullets.length > 0
        ? digestBullets
        : programPlan.main_topics.map(
            (item, index) => `メイントピック${index + 1}: ${summarizeText(item.title, 42)}`
          )),
      ...quickNewsTitles,
      "レターズ: リスナーからのメッセージに番組として回答します。",
      "エンディング: 次回の予告と視点の持ち帰りを整理します。"
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
  const digestConfig = resolveTrendDigestConfigFromRaw({
    denyKeywords: Deno.env.get("TREND_DENY_KEYWORDS") ?? undefined,
    allowCategories: Deno.env.get("TREND_ALLOW_CATEGORIES") ?? undefined,
    maxHardNews: Deno.env.get("TREND_MAX_HARD_NEWS") ?? undefined,
    maxItems: `${topN}`
  });

  const runId = await startRun("plan-topics", {
    step: "plan-topics",
    role: "editor-in-chief",
    episodeDate,
    idempotencyKey,
    lookbackHours,
    topN,
    digestConfig
  });

  try {
    let selectedTrendItems: PlannedTrendItem[] = normalizeProvidedTrends(body.trendCandidates);
    let usedTrendFallback = false;
    let trendFallbackReason: string | null = null;
    let trendLoadError: string | null = null;

    if (selectedTrendItems.length === 0) {
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
    }

    const digestBaseItems = usedTrendFallback ? [...fallbackTrendItems] : selectedTrendItems;
    let digestResult = buildTrendDigest(toDigestSourceItems(digestBaseItems), digestConfig);
    if (digestResult.items.length === 0) {
      usedTrendFallback = true;
      trendFallbackReason = trendFallbackReason ?? "digest_filtered_all";
      digestResult = buildTrendDigest(toDigestSourceItems(fallbackTrendItems), {
        ...digestConfig,
        allowCategories: [],
        denyKeywords: []
      });
    }

    const digestedTrendItems = digestResult.items.map(toPlannedFromDigestItem);
    const trendItemsForScript = withFallbackTrends(
      digestedTrendItems.length > 0 ? digestedTrendItems : [...fallbackTrendItems]
    );
    const programPlan = buildProgramPlan(episodeDate, trendItemsForScript);
    const topic = buildCompatTopic(episodeDate, programPlan, digestResult.items);
    const selectedTrendAudit = selectedTrendItems.map((item) => ({
      id: item.id,
      title: item.title,
      source: item.source,
      category: item.category,
      score: item.score,
      publishedAt: item.publishedAt,
      clusterSize: item.clusterSize
    }));

    await finishRun(runId, {
      step: "plan-topics",
      role: "editor-in-chief",
      episodeDate,
      idempotencyKey,
      topic,
      programPlan,
      lookbackHours,
      topN,
      usedTrendFallback,
      trendFallbackReason,
      trendLoadError,
      trendItems: trendItemsForScript,
      selectedTrendItems: selectedTrendAudit,
      trendDigest: digestResult.items,
      digest_used_count: digestResult.usedCount,
      digest_filtered_count: digestResult.filteredCount,
      digest_category_distribution: digestResult.categoryDistribution,
      digestConfig
    });

    return jsonResponse({
      ok: true,
      episodeDate,
      idempotencyKey,
      role: "editor-in-chief",
      topic,
      programPlan,
      usedTrendFallback,
      trendFallbackReason,
      trendItems: trendItemsForScript,
      selectedTrendItems: selectedTrendAudit,
      trendDigest: digestResult.items,
      digestUsedCount: digestResult.usedCount,
      digestFilteredCount: digestResult.filteredCount,
      digestCategoryDistribution: digestResult.categoryDistribution
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await failRun(runId, message, {
      step: "plan-topics",
      role: "editor-in-chief",
      episodeDate,
      idempotencyKey,
      lookbackHours,
      topN,
      digestConfig
    });

    return jsonResponse({ ok: false, error: message }, 500);
  }
});
