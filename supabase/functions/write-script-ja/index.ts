import { failRun, finishRun, startRun } from "../_shared/jobRuns.ts";
import { jsonResponse } from "../_shared/http.ts";
import {
  findJapaneseEpisodeByTitle,
  insertJapaneseEpisode,
  updateEpisode
} from "../_shared/episodes.ts";
import { type ProgramPlan } from "../_shared/programPlan.ts";
import {
  estimateScriptDurationSec,
  resolveScriptGateConfig,
  type ScriptGateConfig
} from "../_shared/scriptGate.ts";
import {
  normalizeScriptText,
  type ScriptNormalizationMetrics
} from "../_shared/scriptNormalize.ts";
import {
  buildSectionsCharsBreakdown,
  parseScriptSections,
  renderScriptSections,
  type ScriptSection,
  type SectionsCharsBreakdown
} from "../_shared/scriptSections.ts";
import { postEditJapaneseScript } from "../_shared/scriptEditor.ts";
import {
  resolveEpisodeStructureConfigFromRaw,
  validateEpisodeScriptQuality,
  type EpisodeStructureConfig
} from "../_shared/episodeStructure.ts";
import {
  assertNoBadTokens,
  decodeEntities
} from "../_shared/scriptSanitizer.ts";
import {
  compressSummary,
  extractConcreteSignals,
  normalizeHeadline,
  type ConcreteSignals
} from "../_shared/headlineNormalizer.ts";
import {
  extractSpeechKeywords,
  sanitizeSpeechText,
  summarizeForSpeech
} from "../_shared/speechText.ts";

type RequestBody = {
  episodeDate?: string;
  idempotencyKey?: string;
  topic?: {
    title?: string;
    bullets?: string[];
  };
  programPlan?: ProgramPlan;
  trendItems?: {
    id?: string;
    title?: string;
    summary?: string;
    url?: string;
    source?: string;
    category?: string;
    published_at?: string;
    publishedAt?: string;
  }[];
  letters?: {
    display_name?: string;
    text?: string;
    tip_amount?: number | null;
    tip_currency?: string | null;
    tip_provider_payment_id?: string | null;
  }[];
};

type ScriptTrendItem = {
  id: string;
  originalTitle: string;
  broadcastTitle: string;
  summary: string;
  compressedSummary: string;
  summaryLengthBefore: number;
  summaryLengthAfter: number;
  concreteSignals: ConcreteSignals;
  speechKeywords: string[];
  url: string | null;
  source: string;
  category: string;
  publishedAt: string | null;
  isHard: boolean;
};

type ScriptLetter = {
  displayName: string;
  summarizedText: string;
  tipAmount: number | null;
  tipCurrency: string | null;
};

type ItemsUsedCount = {
  deepdive: number;
  quicknews: number;
  letters: number;
};

type ScriptBuildResult = {
  script: string;
  scriptChars: number;
  estimatedDurationSec: number;
  sectionsCharsBreakdown: SectionsCharsBreakdown;
  itemsUsedCount: ItemsUsedCount;
  normalizationMetrics: ScriptNormalizationMetrics;
};

type SummaryCompressionStats = {
  before: number;
  after: number;
};

const REQUIRED_DEEPDIVE_COUNT = 3;
const REQUIRED_QUICKNEWS_COUNT = 6;
const MAX_TREND_ITEMS = 20;
const MAX_LETTERS = 2;
const SCRIPT_MIN_CHARS_FLOOR = 3500;
const MAX_HARD_TOPICS = 1;
const SECTION_BAD_TOKENS = ["http://", "https://", "<a href", "数式", "アンド#8217;"];

const HARD_CATEGORIES = new Set([
  "news",
  "politics",
  "policy",
  "government",
  "economy",
  "business",
  "science",
  "world",
  "crime",
  "accident",
  "disaster",
  "war",
  "hard"
]);

const resolveEpisodeStructureConfig = (): EpisodeStructureConfig => {
  return resolveEpisodeStructureConfigFromRaw({
    deepDiveCount: `${REQUIRED_DEEPDIVE_COUNT}`,
    quickNewsCount: `${REQUIRED_QUICKNEWS_COUNT}`,
    totalTargetChars: Deno.env.get("EPISODE_TOTAL_TARGET_CHARS") ?? undefined
  });
};

const sanitizeNarrationText = (value: string, fallback = ""): string => {
  const cleaned = sanitizeSpeechText(value)
    .replace(/(?:続きを読む|続きを読む|read more)\s*\.{0,3}/gi, " ")
    .replace(/\b(?:確認中|未確認|編集中)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || fallback;
};

const sanitizeUrl = (value: string | undefined): string | null => {
  const raw = decodeEntities((value ?? "").trim()).replace(/<[^>]+>/g, "").replace(/\s+/g, "");
  if (!raw) return null;
  try {
    return new URL(raw).toString();
  } catch {
    return null;
  }
};

const resolveSourceName = (source: string | undefined, url: string | undefined): string => {
  const cleanedSource = sanitizeNarrationText(source ?? "");
  if (cleanedSource) {
    return cleanedSource;
  }

  if (!url) return "公開ソース";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "公開ソース";
  }
};

const ensureSentence = (value: string, fallback: string, maxChars = 180): string => {
  const normalized = sanitizeNarrationText(value, fallback);
  const clipped = normalized.length <= maxChars
    ? normalized
    : `${normalized.slice(0, maxChars).trimEnd()}…`;

  if (/[。！？!?]$/.test(clipped)) {
    return clipped;
  }
  return `${clipped}。`;
};

const isMostlyLatin = (value: string): boolean => {
  const latinCount = (value.match(/[A-Za-z]/g) ?? []).length;
  if (latinCount === 0) return false;
  const japaneseCount = (value.match(/[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/gu) ?? []).length;
  return latinCount > japaneseCount * 2;
};

const dedupeExactLines = (value: string): { text: string; dedupedCount: number } => {
  const lines = value.replace(/\r\n/g, "\n").split("\n");
  const seen = new Set<string>();
  const kept: string[] = [];
  let dedupedCount = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (kept.length === 0 || kept[kept.length - 1] !== "") {
        kept.push("");
      }
      continue;
    }

    if (/^\[[^\]]+\]$/.test(trimmed)) {
      kept.push(trimmed);
      continue;
    }

    if (/^(?:導入:|What happened|具体語:|Why it matters|For you|Watch next|まとめ:|クイックニュース\d+|何が起きた:|押さえる点:|レター\d+:)/u.test(trimmed)) {
      kept.push(trimmed);
      continue;
    }

    const key = trimmed.toLowerCase();
    if (seen.has(key)) {
      dedupedCount += 1;
      continue;
    }

    seen.add(key);
    kept.push(trimmed);
  }

  return {
    text: kept.join("\n").replace(/\n{3,}/g, "\n\n").trim(),
    dedupedCount
  };
};

const limitSectionBody = (
  body: string,
  options: {
    maxLines: number;
    maxChars: number;
    maxLineChars: number;
  }
): string => {
  const limitedLines: string[] = [];

  for (const rawLine of body.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const clipped = line.length <= options.maxLineChars
      ? line
      : `${line.slice(0, options.maxLineChars).trimEnd()}…`;
    limitedLines.push(clipped);
    if (limitedLines.length >= options.maxLines) {
      break;
    }
  }

  const joined = limitedLines.join("\n");
  if (joined.length <= options.maxChars) {
    return joined;
  }

  return `${joined.slice(0, options.maxChars).trimEnd()}…`;
};

const clipScriptAtLineBoundary = (value: string, maxChars: number): string => {
  if (value.length <= maxChars) {
    return value;
  }

  let clipped = value.slice(0, maxChars);
  const lastBreak = clipped.lastIndexOf("\n");
  if (lastBreak > 0) {
    clipped = clipped.slice(0, lastBreak);
  }
  return clipped.trimEnd();
};

const fallbackTrend = (index: number): ScriptTrendItem => {
  const summary = "公開情報ベースで論点を整理し、断定を避けながら背景と影響を短く確認します。";
  const compressedSummary = compressSummary(summary);
  const speechKeywords = extractSpeechKeywords(summary);
  return {
    id: `fallback-${index}`,
    originalTitle: `追加トレンド${index}`,
    broadcastTitle: `追加トレンド${index}`,
    summary,
    compressedSummary,
    summaryLengthBefore: summary.length,
    summaryLengthAfter: compressedSummary.length,
    concreteSignals: extractConcreteSignals(summary),
    speechKeywords,
    url: `https://example.com/fallback/${index}`,
    source: "fallback-editorial",
    category: "general",
    publishedAt: null,
    isHard: false
  };
};

const normalizeTrendItems = (trendItems: RequestBody["trendItems"]): ScriptTrendItem[] => {
  const seenTitles = new Set<string>();
  const normalized = (trendItems ?? [])
    .slice(0, MAX_TREND_ITEMS)
    .map((item, index) => {
      const originalTitle = sanitizeNarrationText(item?.title ?? "");
      if (!originalTitle) return null;

      const normalizedTitle = originalTitle.toLowerCase();
      if (seenTitles.has(normalizedTitle)) return null;
      seenTitles.add(normalizedTitle);

      const summary = sanitizeNarrationText(
        item?.summary ?? "",
        `${originalTitle}に関する更新があり、何が起きたのかと生活への影響を確認します。`
      );
      const url = sanitizeUrl(item?.url);
      const source = resolveSourceName(item?.source, item?.url);
      const category = sanitizeNarrationText(item?.category ?? "general", "general").toLowerCase();
      const compressedSummary = compressSummary(summary);
      const concreteSignals = extractConcreteSignals(`${originalTitle} ${compressedSummary}`);
      const speechKeywords = extractSpeechKeywords(`${originalTitle} ${summary}`);
      const broadcastTitle = normalizeHeadline(originalTitle, category, summary);
      const rawPublishedAt = sanitizeNarrationText(
        item?.published_at ?? item?.publishedAt ?? "",
        ""
      );
      const publishedAt = rawPublishedAt && Number.isNaN(Date.parse(rawPublishedAt))
        ? null
        : rawPublishedAt || null;
      return {
        id: sanitizeNarrationText(item?.id ?? "") || `trend-${index + 1}`,
        originalTitle,
        broadcastTitle,
        summary,
        compressedSummary,
        summaryLengthBefore: summary.length,
        summaryLengthAfter: compressedSummary.length,
        concreteSignals,
        speechKeywords,
        url,
        source,
        category,
        publishedAt,
        isHard: HARD_CATEGORIES.has(category)
      } satisfies ScriptTrendItem;
    })
    .filter((item): item is ScriptTrendItem => item !== null);

  while (normalized.length < REQUIRED_DEEPDIVE_COUNT + REQUIRED_QUICKNEWS_COUNT + 1) {
    normalized.push(fallbackTrend(normalized.length + 1));
  }

  return normalized;
};

const summarizeSummaryCompression = (trendItems: ScriptTrendItem[]): SummaryCompressionStats => {
  return trendItems.reduce(
    (acc, item) => ({
      before: acc.before + item.summaryLengthBefore,
      after: acc.after + item.summaryLengthAfter
    }),
    {
      before: 0,
      after: 0
    }
  );
};

const normalizeLetters = (letters: RequestBody["letters"]): ScriptLetter[] => {
  const summarizeLetterText = (text: string): string => {
    const sanitized = sanitizeNarrationText(text);
    if (!sanitized) {
      return "応援メッセージをいただきました。";
    }

    const maxSummaryChars = 140;
    return sanitized.length <= maxSummaryChars
      ? sanitized
      : `${sanitized.slice(0, maxSummaryChars).trimEnd()}…`;
  };

  return (letters ?? [])
    .filter((letter) => Boolean(letter?.display_name && letter?.text))
    .slice(0, MAX_LETTERS)
    .map((letter) => ({
      displayName: sanitizeNarrationText(letter?.display_name ?? "", "リスナー"),
      summarizedText: summarizeLetterText(letter?.text ?? ""),
      tipAmount: typeof letter?.tip_amount === "number" ? letter.tip_amount : null,
      tipCurrency: typeof letter?.tip_currency === "string" ? letter.tip_currency : null
    }));
};

const formatTipAmount = (tipAmount: number | null, tipCurrency: string | null): string | null => {
  if (tipAmount === null || Number.isNaN(tipAmount) || tipAmount < 0) {
    return null;
  }

  const currency = (tipCurrency ?? "jpy").toLowerCase();
  if (currency === "jpy") {
    return `${tipAmount.toLocaleString("ja-JP")}円`;
  }

  return `${(tipAmount / 100).toFixed(2)} ${currency.toUpperCase()}`;
};

const pickDeepDiveItems = (trendItems: ScriptTrendItem[]): ScriptTrendItem[] => {
  const chosen: ScriptTrendItem[] = [];
  let hardCount = 0;

  for (const item of trendItems) {
    if (chosen.length >= REQUIRED_DEEPDIVE_COUNT) break;
    if (item.isHard && hardCount >= MAX_HARD_TOPICS) continue;
    chosen.push(item);
    if (item.isHard) hardCount += 1;
  }

  let cursor = 0;
  while (chosen.length < REQUIRED_DEEPDIVE_COUNT) {
    const fallback = trendItems[cursor] ?? fallbackTrend(cursor + 1);
    if (!chosen.some((item) => item.id === fallback.id)) {
      chosen.push(fallback);
    }
    cursor += 1;
  }

  return chosen;
};

const pickQuickNewsItems = (trendItems: ScriptTrendItem[], deepDiveItems: ScriptTrendItem[]): ScriptTrendItem[] => {
  const deepDiveIds = new Set(deepDiveItems.map((item) => item.id));
  const seenTitles = new Set<string>();
  const quickNews: ScriptTrendItem[] = [];
  let hardCount = deepDiveItems.filter((item) => item.isHard).length;

  for (const item of trendItems) {
    if (quickNews.length >= REQUIRED_QUICKNEWS_COUNT) break;
    if (deepDiveIds.has(item.id)) continue;
    if (item.isHard && hardCount >= MAX_HARD_TOPICS) continue;
    const normalizedTitle = item.broadcastTitle.toLowerCase();
    if (seenTitles.has(normalizedTitle)) continue;
    quickNews.push(item);
    seenTitles.add(normalizedTitle);
    if (item.isHard) hardCount += 1;
  }

  let cursor = 0;
  while (quickNews.length < REQUIRED_QUICKNEWS_COUNT) {
    const fallback = fallbackTrend(cursor + 200);
    quickNews.push(fallback);
    cursor += 1;
  }

  return quickNews;
};

const resolveTopicTitle = (rawTitle: string | undefined, episodeDate: string): string => {
  const normalized = sanitizeNarrationText(rawTitle ?? "");
  if (!normalized || /^staging topic\b/i.test(normalized)) {
    return `デイリートピック ${episodeDate}`;
  }
  return normalized;
};

const toNarrationSummary = (summary: string, maxSentences: number): string => {
  const sourceText = isMostlyLatin(summary) ? compressSummary(summary) : summary;
  const summarized = summarizeForSpeech(sourceText, {
    maxSentences,
    maxChars: maxSentences > 1 ? 260 : 180,
    fallback: "公開情報を横断して、事実ベースで更新点を確認します。"
  });
  return ensureSentence(summarized, "公開情報を整理します。", 260);
};

const formatPublishedAt = (value: string | null): string => {
  if (!value) return "最新";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "最新";
  return `${parsed.getUTCMonth() + 1}月${parsed.getUTCDate()}日`;
};

const CATEGORY_IMPACT_LABEL: Record<string, string> = {
  game: "運営施策とユーザー行動",
  movie: "配信戦略と広告設計",
  entertainment: "視聴体験と規制対応",
  anime: "配信編成とファン施策",
  tech: "プロダクト導入と運用負荷",
  gadgets: "購買判断と利用体験",
  business: "予算配分と実務優先度",
  economy: "価格判断とリスク管理"
};

const resolveCategoryImpact = (category: string): string => {
  return CATEGORY_IMPACT_LABEL[category] ?? "現場の優先順位";
};

const resolveDeepDiveAnchors = (trend: ScriptTrendItem): string[] => {
  const combined = [
    ...trend.speechKeywords,
    ...trend.concreteSignals.actors,
    ...trend.concreteSignals.numbers
  ];
  const seen = new Set<string>();
  const anchors: string[] = [];
  for (const token of combined) {
    const normalized = sanitizeNarrationText(token);
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    anchors.push(normalized);
    if (anchors.length >= 4) break;
  }
  if (anchors.length === 0) {
    anchors.push(trend.broadcastTitle);
  }
  return anchors;
};

const prependAnchorIfMissing = (sentence: string, anchor: string): string => {
  if (!anchor || sentence.includes(anchor)) return sentence;
  const trimmed = sentence.replace(/[。！？!?]+$/u, "");
  return ensureSentence(`${anchor}では、${trimmed}`, sentence, 260);
};

const buildWhyItMattersLine = (trend: ScriptTrendItem, anchor: string, planIntro: string | null): string => {
  if (planIntro) {
    return ensureSentence(planIntro, "なぜ重要かを確認します。", 230);
  }

  const dateLabel = formatPublishedAt(trend.publishedAt);
  const metric = trend.concreteSignals.numbers[0];
  const metricPart = metric ? `数字では${metric}が判断の分岐点です。` : "";
  return ensureSentence(
    `${anchor}の更新は${dateLabel}時点で確認され、${resolveCategoryImpact(trend.category)}に直結します。${metricPart}`,
    "更新の背景を確認します。",
    230
  );
};

const buildForYouLine = (trend: ScriptTrendItem, anchor: string, planImpact: string | null): string => {
  if (planImpact) {
    return ensureSentence(planImpact, "生活への影響を整理します。", 230);
  }

  return ensureSentence(
    `${anchor}を追うときは、「今日決めること」と「様子を見ること」を先に分けます。一次情報を1本だけ固定すると、ノイズを減らして判断できます。`,
    "生活への影響を整理します。",
    230
  );
};

const buildWatchNextLine = (trend: ScriptTrendItem, anchor: string, planSupplement: string | null): string => {
  if (planSupplement) {
    return ensureSentence(planSupplement, "次の注目点を確認します。", 230);
  }

  const secondary = resolveDeepDiveAnchors(trend).find((token) => token !== anchor) ?? "次の更新";
  return ensureSentence(
    `${formatPublishedAt(trend.publishedAt)}時点の前提が維持されるか、次は${secondary}の更新を確認します。見出しより更新時刻と更新内容の差分を優先します。`,
    "次の注目点を確認します。",
    230
  );
};

const buildConcreteSignalLine = (trend: ScriptTrendItem): string => {
  const parts: string[] = [];
  const anchors = resolveDeepDiveAnchors(trend);
  if (anchors.length > 0) {
    parts.push(`固有語は${anchors.slice(0, 2).join("、")}`);
  }
  if (trend.concreteSignals.numbers.length > 0) {
    parts.push(`数字は${trend.concreteSignals.numbers.slice(0, 2).join("、")}`);
  }
  if (trend.concreteSignals.dates.length > 0) {
    parts.push(`時点は${trend.concreteSignals.dates.slice(0, 1).join("、")}`);
  }

  if (parts.length === 0) {
    return ensureSentence("一次情報の更新差分を確認します。", "具体情報を整理します。", 180);
  }
  return ensureSentence(parts.join("。"), "具体情報を整理します。", 200);
};

const buildOp = (topicTitle: string): string => {
  const broadcastTopicTitle = normalizeHeadline(topicTitle, "general");
  return limitSectionBody(
    [
      `おはようございます。今日の番組テーマは「${sanitizeNarrationText(broadcastTopicTitle, "今日のトレンド")}」です。`,
      "まず30秒で全体地図を確認し、そのあとDeepDiveを3本、QuickNewsを6本、最後にレターズとエンディングで締めます。",
      "速報の熱量に引きずられないように、事実、解釈、次のアクションを分けて話します。"
    ].join("\n"),
    {
      maxLines: 8,
      maxChars: 560,
      maxLineChars: 180
    }
  );
};

const buildHeadline = (deepDiveItems: ScriptTrendItem[], quickNewsItems: ScriptTrendItem[]): string => {
  const mainLine = deepDiveItems
    .map(
      (item, index) =>
        `注目${index + 1}は${ensureSentence(item.broadcastTitle, `トピック${index + 1}`, 72)}`
    )
    .join(" ");

  return limitSectionBody(
    [
      "HEADLINEです。今日の全体地図を30秒で確認します。",
      mainLine,
      `QuickNewsは${quickNewsItems.length}本です。短く回しながら、なぜ話題かだけを押さえます。`,
      "流し聞きでも追えるように、各セクションの最後で持ち帰りを一行で言い切ります。"
    ].join("\n"),
    {
      maxLines: 10,
      maxChars: 700,
      maxLineChars: 190
    }
  );
};

const buildDeepDive = (
  trend: ScriptTrendItem,
  index: number,
  _programPlan: ProgramPlan
): string => {
  const anchors = resolveDeepDiveAnchors(trend);
  const primaryAnchor = anchors[0] ?? trend.broadcastTitle;
  const whatHappenedSource = trend.summary || trend.compressedSummary;
  const whatHappened = prependAnchorIfMissing(toNarrationSummary(whatHappenedSource, 2), primaryAnchor);
  const concreteSignals = buildConcreteSignalLine(trend);
  const whyTopic = buildWhyItMattersLine(trend, primaryAnchor, null);
  const lifeImpact = buildForYouLine(trend, primaryAnchor, null);
  const watchPoint = buildWatchNextLine(trend, primaryAnchor, null);
  const closing = ensureSentence(
    `まとめると、${primaryAnchor}は更新順で追うと、見出しだけでは見えない判断差分が拾えます。`,
    "まとめると、更新差分を追う視点が今日の持ち帰りです。",
    180
  );

  return limitSectionBody(
    [
      `導入: DeepDive${index + 1}は「${sanitizeNarrationText(trend.broadcastTitle, `トピック${index + 1}`)}」。`,
      `What happened（何が起きた）: ${whatHappened}`,
      `具体語: ${concreteSignals}`,
      `Why it matters（なぜ重要か）: ${whyTopic}`,
      `For you（あなたへの影響）: ${lifeImpact}`,
      `Watch next（次の注目）: ${watchPoint}`,
      `まとめ: ${closing}`,
      `実務メモ: ${primaryAnchor}は、確定情報・未確定情報・確認期限の3点でメモすると、次回更新時に判断を更新しやすくなります。`
    ].join("\n"),
    {
      maxLines: 13,
      maxChars: 1350,
      maxLineChars: 220
    }
  );
};

const buildQuickNewsSection = (quickNewsItems: ScriptTrendItem[]): string => {
  const lines: string[] = ["QuickNewsです。ここはテンポ重視で6本続けます。"];

  for (const [index, item] of quickNewsItems.entries()) {
    const summary = toNarrationSummary(item.summary, 1);
    const anchor = resolveDeepDiveAnchors(item)[0] ?? item.broadcastTitle;
    const why = ensureSentence(
      `${formatPublishedAt(item.publishedAt)}時点で更新があり、${anchor}が${resolveCategoryImpact(item.category)}に影響するためです。`,
      "更新速度が速く、判断の材料になるためです。",
      170
    );
    lines.push(
      `クイックニュース${index + 1}: ${ensureSentence(item.broadcastTitle, `ニュース${index + 1}`, 78)}`
    );
    lines.push(`何が起きた: ${summary}`);
    lines.push(`押さえる点: ${why}`);
  }

  lines.push("補足: QuickNewsの段階では断定せず、明日までに確認する差分項目を一つ決めるだけで十分です。");
  lines.push("以上、QuickNewsでした。あとで深掘りしたい項目は、タイトルと理由だけ先にメモしておくと追いやすいです。");

  return limitSectionBody(lines.join("\n"), {
    maxLines: 26,
    maxChars: 1650,
    maxLineChars: 220
  });
};

const buildLettersSection = (letters: ScriptLetter[]): string => {
  if (letters.length === 0) {
    return limitSectionBody(
      [
        "Lettersです。今日は実際のお便りがないので、募集と想定質問で進めます。",
        "募集: いま追っているトレンドで、番組に取り上げてほしいものを一行で送ってください。",
        "想定質問: 情報更新が速い話題で、どの時点で判断すべきですか。",
        "回答: まず判断期限を先に決めます。次に、その期限までに確認する一次情報を2つだけ固定します。",
        "補足: 最後に、判断を保留する条件を一つだけ決めておくと、情報が更新されたときに迷いを減らせます。"
      ].join("\n"),
      {
        maxLines: 10,
        maxChars: 760,
        maxLineChars: 200
      }
    );
  }

  const lines = ["Lettersです。いただいたメッセージに短く返していきます。"];
  for (const [index, letter] of letters.entries()) {
    const tipAmount = formatTipAmount(letter.tipAmount, letter.tipCurrency);
    const thanks = tipAmount
      ? `${letter.displayName}さん、${tipAmount}のサポートありがとうございます。`
      : `${letter.displayName}さん、お便りありがとうございます。`;
    lines.push(`レター${index + 1}: ${thanks}`);
    lines.push(`本文要約: ${ensureSentence(letter.summarizedText, "応援メッセージをいただきました。", 170)}`);
    lines.push("返答: まず結論を一行、その根拠を一行、最後に次の行動を一行で返します。");
  }

  return limitSectionBody(lines.join("\n"), {
    maxLines: 12,
    maxChars: 880,
    maxLineChars: 200
  });
};

const buildOutro = (): string => {
  return limitSectionBody(
    [
      "OUTROです。今日は全体地図、DeepDive3本、QuickNews6本で更新差分を追いました。",
      "明日も同じ構成で、変化した点だけを短く重ねていきます。",
      "次回も要点だけを短く更新していきます。",
      "本文は耳で追えるテンポを優先しました。",
      "最後までありがとうございました。"
    ].join("\n"),
    {
      maxLines: 8,
      maxChars: 540,
      maxLineChars: 180
    }
  );
};

const buildSourcesSection = (
  trendItems: ScriptTrendItem[],
  deepDiveItems: ScriptTrendItem[],
  quickNewsItems: ScriptTrendItem[]
): { sources: string; sourceReferences: string } => {
  const deepDiveIds = new Set(deepDiveItems.map((item) => item.id));
  const quickNewsIds = new Set(quickNewsItems.map((item) => item.id));
  const compactUrl = (value: string | null): string => {
    if (!value) return "(url unavailable)";
    try {
      const parsed = new URL(value);
      const pathSegments = parsed.pathname
        .split("/")
        .map((segment) => segment.trim())
        .filter((segment) => segment.length > 0);
      const shortPath = pathSegments.length > 0 ? `/${pathSegments.slice(0, 2).join("/")}` : "/";
      const hasMore = pathSegments.length > 2 || parsed.search.length > 0 || parsed.hash.length > 0;
      const compact = `${parsed.origin}${shortPath}${hasMore ? "/..." : ""}`;
      if (compact.length <= 96) return compact;
      return `${compact.slice(0, 96).trimEnd()}…`;
    } catch {
      return value.length <= 96 ? value : `${value.slice(0, 96).trimEnd()}…`;
    }
  };

  const prioritized = [...deepDiveItems, ...quickNewsItems, ...trendItems]
    .filter((item, index, all) => all.findIndex((candidate) => candidate.id === item.id) === index)
    .slice(0, 6);

  const rows = prioritized
    .map((item, index) => {
      const section = deepDiveIds.has(item.id) ? "DeepDive" : quickNewsIds.has(item.id) ? "QuickNews" : "Reference";
      const url = compactUrl(item.url);
      return `${index + 1}. [${section}] ${item.source} | ${item.category} | URL: ${url}`;
    });

  const referenceLines = prioritized
    .map((item, index) => `${index + 1}. trend_item_id=${item.id}`);

  return {
    sources: rows.join("\n"),
    sourceReferences: [
      "本文にはURLを出しません。URLはSOURCESセクションのみです。",
      ...referenceLines
    ].join("\n")
  };
};

const buildFallbackProgramPlan = (topicTitle: string): ProgramPlan => {
  return {
    role: "editor-in-chief",
    main_topics: new Array(REQUIRED_DEEPDIVE_COUNT).fill(0).map((_, index) => ({
      title: `${topicTitle} の論点 ${index + 1}`,
      source: "公開ソース",
      category: "general",
      intro: `${topicTitle}で、いま何が変化しているかを短く確認します。`,
      background: "背景は一次情報の更新順に整理し、先に事実を固定します。",
      impact: "生活側の体験と、運用側の判断コストの両方に分けて影響を確認します。",
      supplement: "次の更新で見直すべきポイントを明示し、断定を避けます。"
    })),
    quick_news: [],
    small_talk: [],
    letters: {
      host_prompt: "感謝を伝えたうえで、次の一歩につながる返答を短く返します。"
    },
    ending: {
      message: "今日の論点を一行で振り返り、次回の注目点を添えて締めます。"
    }
  };
};

const ensureProgramPlan = (plan: ProgramPlan | undefined, topicTitle: string): ProgramPlan => {
  if (!plan || plan.role !== "editor-in-chief") {
    return buildFallbackProgramPlan(topicTitle);
  }

  return {
    role: "editor-in-chief",
    main_topics: plan.main_topics,
    quick_news: plan.quick_news,
    small_talk: plan.small_talk,
    letters: plan.letters ?? { host_prompt: "感謝を伝え、次の行動を提案します。" },
    ending: plan.ending ?? { message: "本日の更新は以上です。" }
  };
};

const stripSourcesForValidation = (script: string): string => {
  const sections = parseScriptSections(script);
  if (sections.length === 0) {
    return script;
  }
  return sections
    .filter((section) => !/^SOURCES(?:_FOR_UI)?$/i.test(section.heading))
    .map((section) => section.body)
    .join("\n");
};

const assertScriptRules = (script: string): void => {
  const narrationOnly = stripSourcesForValidation(script);
  assertNoBadTokens(narrationOnly, SECTION_BAD_TOKENS);

  if (/補足\s*\d+/u.test(narrationOnly)) {
    throw new Error("bad_tokens_detected:補足N");
  }

  if (/https?:\/\//i.test(narrationOnly) || /\bwww\./i.test(narrationOnly)) {
    throw new Error("bad_tokens_detected:url_in_narration");
  }
};

const padDeepDiveForLength = (value: string, topicTitle: string): string => {
  const additions = [
    `${topicTitle}を追うときは、更新日時と引用元をセットで確認すると誤読を防げます。`,
    "短期の盛り上がりだけで判断せず、翌日の更新で前提が変わる可能性を残しておくのが実務的です。"
  ];
  let padded = value;
  for (const addition of additions) {
    if (padded.length >= 980) break;
    if (!padded.includes(addition)) {
      padded = `${padded}\n${addition}`;
    }
  }
  return padded;
};

const buildJapaneseScript = (params: {
  topicTitle: string;
  programPlan: ProgramPlan;
  trendItems: ScriptTrendItem[];
  letters: ScriptLetter[];
  scriptGate: ScriptGateConfig;
  episodeStructure: EpisodeStructureConfig;
}): ScriptBuildResult => {
  const deepDiveItems = pickDeepDiveItems(params.trendItems);
  const quickNewsItems = pickQuickNewsItems(params.trendItems, deepDiveItems);

  const deepDiveSections = deepDiveItems.map((item, index) => {
    const body = padDeepDiveForLength(buildDeepDive(item, index, params.programPlan), item.broadcastTitle);
    return {
      heading: `DEEPDIVE ${index + 1}`,
      body
    } satisfies ScriptSection;
  });

  const sectionBlocks: ScriptSection[] = [
    {
      heading: "OP",
      body: buildOp(params.topicTitle)
    },
    {
      heading: "HEADLINE",
      body: buildHeadline(deepDiveItems, quickNewsItems)
    },
    ...deepDiveSections,
    {
      heading: "QUICK NEWS",
      body: buildQuickNewsSection(quickNewsItems)
    },
    {
      heading: "LETTERS",
      body: buildLettersSection(params.letters)
    },
    {
      heading: "OUTRO",
      body: buildOutro()
    }
  ];

  const normalizedSectionBlocks = sectionBlocks.map((section) => {
    const normalizedBody = section.body
      .split(/\r?\n/)
      .map((line) => sanitizeNarrationText(line))
      .filter((line) => line.length > 0)
      .join("\n")
      .trim();

    const restoredBody = section.heading === "SOURCES" || section.heading === "SOURCES_FOR_UI"
      ? section.body
      : normalizedBody;

    return {
      heading: section.heading,
      body: restoredBody
    } satisfies ScriptSection;
  });

  const draft = renderScriptSections(normalizedSectionBlocks);
  const deduped = dedupeExactLines(draft);
  let normalized = deduped.text;

  let finalNormalization = normalizeScriptText(normalized, { preserveSourceUrls: true });

  const minCharsTarget = Math.max(params.scriptGate.minChars, SCRIPT_MIN_CHARS_FLOOR);
  const lengthExpansionPhrases = [
    "実務の観点では、同じ話題でも前提条件の差分を先に整理しておくと、翌日の更新に追従しやすくなります。",
    "判断前に、更新主体・対象範囲・確認期限の三点を一行で並べると、関係者との認識ズレを減らせます。",
    "確定情報と未確定情報を分け、未確定側には保留条件を添えることで、拙速な判断を避けられます。",
    "次回確認する差分項目を一つだけ決めておくと、情報追跡の負荷を抑えつつ継続できます。"
  ];
  let expansionCursor = 0;
  while (finalNormalization.text.length < minCharsTarget && expansionCursor < lengthExpansionPhrases.length) {
    const sections = parseScriptSections(finalNormalization.text);
    const phrase = lengthExpansionPhrases[expansionCursor];
    const expanded = sections.map((section) => {
      if (/^DEEPDIVE\s+\d+$/i.test(section.heading)) {
        const body = section.body.includes(phrase) ? section.body : `${section.body}\n${phrase}`;
        return { heading: section.heading, body };
      }
      if (/^QUICK NEWS$/i.test(section.heading) && expansionCursor === 0) {
        const extra =
          "補足: ここで挙げた項目は、重要度よりも更新速度を基準に選んでいます。後で優先順位を付け直す前提で押さえてください。";
        const body = section.body.includes(extra) ? section.body : `${section.body}\n${extra}`;
        return { heading: section.heading, body };
      }
      return section;
    });

    finalNormalization = normalizeScriptText(renderScriptSections(expanded), {
      preserveSourceUrls: true
    });
    expansionCursor += 1;
  }

  if (finalNormalization.text.length > params.scriptGate.maxChars) {
    finalNormalization = {
      ...finalNormalization,
      text: clipScriptAtLineBoundary(finalNormalization.text, params.scriptGate.maxChars)
    };
  }

  assertScriptRules(finalNormalization.text);

  const scriptChars = finalNormalization.text.length;
  const estimatedDurationSec = estimateScriptDurationSec(scriptChars, params.scriptGate.charsPerMin);
  const sectionsCharsBreakdown = buildSectionsCharsBreakdown(finalNormalization.text);

  return {
    script: finalNormalization.text,
    scriptChars,
    estimatedDurationSec,
    sectionsCharsBreakdown,
    itemsUsedCount: {
      deepdive: deepDiveItems.length,
      quicknews: quickNewsItems.length,
      letters: params.letters.length
    },
    normalizationMetrics: {
      ...finalNormalization.metrics,
      dedupedLinesCount: finalNormalization.metrics.dedupedLinesCount + deduped.dedupedCount
    }
  };
};

const mergeNormalizationMetrics = (
  left: ScriptNormalizationMetrics,
  right: ScriptNormalizationMetrics
): ScriptNormalizationMetrics => {
  return {
    removedHtmlCount: left.removedHtmlCount + right.removedHtmlCount,
    decodedHtmlEntityCount: left.decodedHtmlEntityCount + right.decodedHtmlEntityCount,
    removedUrlCount: left.removedUrlCount + right.removedUrlCount,
    removedPlaceholderCount: left.removedPlaceholderCount + right.removedPlaceholderCount,
    dedupedLinesCount: left.dedupedLinesCount + right.dedupedLinesCount
  };
};

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "method_not_allowed" }, 405);
  }

  const body = (await req.json().catch(() => ({}))) as RequestBody;
  const episodeDate = body.episodeDate ?? new Date().toISOString().slice(0, 10);
  const idempotencyKey = body.idempotencyKey ?? `daily-${episodeDate}`;
  const topicTitle = resolveTopicTitle(body.topic?.title, episodeDate);
  const trendItems = normalizeTrendItems(body.trendItems);
  const summaryCompressionStats = summarizeSummaryCompression(trendItems);
  const letters = normalizeLetters(body.letters);
  const programPlan = ensureProgramPlan(body.programPlan, topicTitle);
  const scriptGate = resolveScriptGateConfig();
  const episodeStructure = resolveEpisodeStructureConfig();
  const title = `Daily Topic ${episodeDate} (JA)`;
  const description = `Japanese episode for ${episodeDate}`;
  const drafted = buildJapaneseScript({
    topicTitle,
    trendItems,
    letters,
    programPlan,
    scriptGate,
    episodeStructure
  });

  const editorResult = await postEditJapaneseScript(drafted.script);
  const ttsPreprocessed = {
    text: editorResult.script,
    changed: false,
    metrics: {
      urlReplacedCount: 0,
      bracketRemovedCount: 0,
      mappedWordCount: 0,
      pauseInsertedCount: 0
    }
  };
  const postTtsNormalization = normalizeScriptText(ttsPreprocessed.text, { preserveSourceUrls: true });
  const boundedScript = postTtsNormalization.text.length > scriptGate.maxChars
    ? postTtsNormalization.text.slice(0, scriptGate.maxChars).trimEnd()
    : postTtsNormalization.text;
  assertScriptRules(boundedScript);

  const finalScript = boundedScript;
  const finalScriptChars = finalScript.length;
  const finalEstimatedDurationSec = estimateScriptDurationSec(finalScriptChars, scriptGate.charsPerMin);
  const finalSectionsCharsBreakdown = buildSectionsCharsBreakdown(finalScript);
  const baseNormalizationMetrics = editorResult.edited
    ? editorResult.normalizationMetrics
    : drafted.normalizationMetrics;
  const normalizationMetrics = mergeNormalizationMetrics(
    baseNormalizationMetrics,
    postTtsNormalization.metrics
  );

  const scriptQualityGate = validateEpisodeScriptQuality({
    script: finalScript,
    itemsUsedCount: drafted.itemsUsedCount,
    config: episodeStructure
  });

  const runPayloadBase = {
    step: "write-script-ja",
    role: "editor-in-chief",
    episodeDate,
    idempotencyKey,
    title,
    trendItemsCount: trendItems.length,
    lettersCount: letters.length,
    scriptChars: finalScriptChars,
    scriptLength: finalScriptChars,
    estimatedDurationSec: finalEstimatedDurationSec,
    chars_actual: finalScriptChars,
    chars_min: scriptGate.minChars,
    chars_target: scriptGate.targetChars,
    chars_max: scriptGate.maxChars,
    sections_chars_breakdown: finalSectionsCharsBreakdown,
    removed_html_count: normalizationMetrics.removedHtmlCount,
    removed_url_count: normalizationMetrics.removedUrlCount,
    deduped_lines_count: normalizationMetrics.dedupedLinesCount,
    script_editor_enabled: editorResult.enabled,
    script_editor_applied: editorResult.edited,
    script_editor_model: editorResult.model,
    script_editor_error: editorResult.error,
    tts_preprocess_applied: ttsPreprocessed.changed,
    tts_preprocess_metrics: ttsPreprocessed.metrics,
    script_quality_gate: scriptQualityGate,
    expand_attempted: 0,
    items_used_count: drafted.itemsUsedCount,
    deepDiveCount: drafted.itemsUsedCount.deepdive,
    quickNewsCount: drafted.itemsUsedCount.quicknews,
    normalizedHeadlineUsed: true,
    summaryLengthBefore: summaryCompressionStats.before,
    summaryLengthAfter: summaryCompressionStats.after,
    episodeStructure,
    scriptGate
  };

  const runId = await startRun("write-script-ja", runPayloadBase);

  try {
    if (!scriptQualityGate.ok) {
      throw new Error(`script_quality_gate_failed:${scriptQualityGate.violations.join(",")}`);
    }

    let episode = await findJapaneseEpisodeByTitle(title);
    let noOp = false;

    if (!episode) {
      episode = await insertJapaneseEpisode({ title, description, script: finalScript });
      episode = await updateEpisode(episode.id, { duration_sec: finalEstimatedDurationSec });
    } else if (!episode.script || episode.status === "failed" || episode.script !== finalScript) {
      await updateEpisode(episode.id, { status: "generating" });
      episode = await updateEpisode(episode.id, {
        script: finalScript,
        description,
        status: "draft",
        duration_sec: finalEstimatedDurationSec
      });
    } else {
      noOp = true;
    }

    await finishRun(runId, {
      ...runPayloadBase,
      episodeId: episode.id,
      status: episode.status,
      noOp
    });

    return jsonResponse({
      ok: true,
      episodeDate,
      idempotencyKey,
      episodeId: episode.id,
      title: episode.title,
      status: episode.status,
      trendItemsCount: trendItems.length,
      lettersCount: letters.length,
      scriptChars: finalScriptChars,
      scriptLength: finalScriptChars,
      estimatedDurationSec: finalEstimatedDurationSec,
      chars_actual: finalScriptChars,
      chars_min: scriptGate.minChars,
      chars_target: scriptGate.targetChars,
      chars_max: scriptGate.maxChars,
      sections_chars_breakdown: finalSectionsCharsBreakdown,
      removed_html_count: normalizationMetrics.removedHtmlCount,
      removed_url_count: normalizationMetrics.removedUrlCount,
      deduped_lines_count: normalizationMetrics.dedupedLinesCount,
      script_editor_enabled: editorResult.enabled,
      script_editor_applied: editorResult.edited,
      script_editor_model: editorResult.model,
      script_editor_error: editorResult.error,
      tts_preprocess_applied: ttsPreprocessed.changed,
      tts_preprocess_metrics: ttsPreprocessed.metrics,
      script_quality_gate: scriptQualityGate,
      expand_attempted: 0,
      items_used_count: drafted.itemsUsedCount,
      deepDiveCount: drafted.itemsUsedCount.deepdive,
      quickNewsCount: drafted.itemsUsedCount.quicknews,
      normalizedHeadlineUsed: true,
      summaryLengthBefore: summaryCompressionStats.before,
      summaryLengthAfter: summaryCompressionStats.after,
      episodeStructure,
      scriptGate
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await failRun(runId, message, runPayloadBase);
    return jsonResponse({ ok: false, error: message }, 500);
  }
});
