export type TrendDigestSourceItem = {
  id: string;
  title: string;
  summary: string;
  source: string;
  url: string;
  category: string;
  score: number;
  publishedAt: string | null;
  clusterSize: number;
};

export type TrendDigestToneTag = "fun" | "neutral" | "serious";

export type TrendDigestItem = {
  id: string;
  cleanedTitle: string;
  whatHappened: string;
  whyItMatters: string;
  toneTag: TrendDigestToneTag;
  category: string;
  source: string;
  url: string;
  score: number;
  publishedAt: string | null;
  clusterSize: number;
};

export type TrendDigestConfig = {
  denyKeywords: string[];
  allowCategories: string[];
  maxHardNews: number;
  maxItems: number;
};

export type TrendDigestResult = {
  items: TrendDigestItem[];
  usedCount: number;
  filteredCount: number;
  categoryDistribution: Record<string, number>;
};

const DEFAULT_MAX_HARD_NEWS = 1;
const DEFAULT_MAX_ITEMS = 12;

export const DEFAULT_TREND_DENY_KEYWORDS = [
  "porn",
  "pornography",
  "sexual",
  "explicit sex",
  "nude",
  "self-harm",
  "suicide",
  "kill yourself",
  "illegal drug",
  "cocaine",
  "meth",
  "fentanyl",
  "覚醒剤",
  "麻薬",
  "違法薬物",
  "自殺",
  "リストカット",
  "性的"
];

const HARD_NEWS_CATEGORIES = new Set([
  "news",
  "politics",
  "policy",
  "government",
  "world",
  "economy",
  "business"
]);

const ENTERTAINMENT_CATEGORIES = new Set([
  "entertainment",
  "anime",
  "game",
  "gaming",
  "movie",
  "music",
  "video",
  "youtube",
  "streaming",
  "celebrity",
  "culture"
]);

const DEFAULT_WHY_IT_MATTERS_BY_CATEGORY: Record<string, string> = {
  entertainment: "話題の温度感が高く、リスナーの日常に直結するためです。",
  anime: "作品・配信・イベントの動きが早く、追い方の判断材料になるためです。",
  game: "発売・運営・ユーザー行動の変化が読み取れるためです。",
  movie: "配信と興行の両面で、次の消費トレンドを先読みしやすいためです。",
  music: "配信動向とSNS拡散の関係が見え、トレンド理解に役立つためです。",
  video: "クリエイターと視聴者の動線が変わり、情報接触の仕方に影響するためです。",
  news: "社会的影響が大きく、背景整理が必要な話題だからです。",
  politics: "制度変更や議論の前提を確認しないと誤読しやすいためです。",
  business: "市場や企業行動の変化が、実務判断に波及するためです。",
  tech: "プロダクト実装と利用体験の両方に影響するためです。"
};

const BANNED_TEXT_TOKENS = ["<a", "http", "&#", "#8217", "数式"];

const normalizeToken = (value: string): string => value.trim().toLowerCase();

const compactText = (value: string): string => value.replace(/\s+/g, " ").trim();

const decodeHtmlEntities = (value: string): string => {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, "\"")
    .replace(/&nbsp;/gi, " ")
    .replace(/&#39;/gi, "'")
    .replace(/&#8217;/gi, "'")
    .replace(/&#(\d+);/g, (_match, code) => {
      const codePoint = Number.parseInt(code, 10);
      return Number.isNaN(codePoint) ? " " : String.fromCodePoint(codePoint);
    });
};

const stripHtmlAndAnchors = (value: string): string => {
  return value
    .replace(/<a\b[^>]*>/gi, " ")
    .replace(/<\/a>/gi, " ")
    .replace(/<[^>]+>/g, " ");
};

const removeUrls = (value: string): string => {
  return value.replace(/https?:\/\/\S+/gi, " ").replace(/\bwww\.\S+/gi, " ");
};

const removeBannedTokens = (value: string): string => {
  let output = value;
  for (const token of BANNED_TEXT_TOKENS) {
    const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    output = output.replace(new RegExp(escaped, "gi"), " ");
  }
  return output;
};

const cleanDigestText = (value: string): string => {
  return compactText(removeBannedTokens(removeUrls(decodeHtmlEntities(stripHtmlAndAnchors(value)))));
};

const summarizeSentences = (value: string, maxSentences: number): string => {
  const sentences = value
    .split(/(?<=[。.!?！？])\s+/u)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);

  if (sentences.length === 0) return "";
  return sentences.slice(0, maxSentences).join(" ");
};

const ensureSentence = (value: string, fallback: string): string => {
  const compacted = compactText(value) || fallback;
  if (/[。.!?！？]$/.test(compacted)) return compacted;
  return `${compacted}。`;
};

const resolveToneTag = (category: string): TrendDigestToneTag => {
  const normalized = normalizeToken(category);
  if (ENTERTAINMENT_CATEGORIES.has(normalized)) return "fun";
  if (HARD_NEWS_CATEGORIES.has(normalized)) return "serious";
  return "neutral";
};

const resolveWhyItMatters = (category: string, cleanedTitle: string): string => {
  const normalized = normalizeToken(category);
  const mapped = DEFAULT_WHY_IT_MATTERS_BY_CATEGORY[normalized];
  if (mapped) {
    return ensureSentence(mapped, "番組の視点整理に役立つためです。");
  }

  return ensureSentence(
    `${cleanedTitle}の背景を押さえることで、見出しだけでは見えない文脈を補えるためです。`,
    "背景を押さえることで文脈を誤読しにくくなるためです。"
  );
};

const parsePositiveInt = (raw: string | undefined, fallback: number): number => {
  const parsed = Number.parseInt(raw ?? "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
};

export const parseCsvTokens = (raw: string | undefined): string[] => {
  if (!raw) return [];
  return raw
    .split(",")
    .map((token) => normalizeToken(token))
    .filter((token) => token.length > 0);
};

export const resolveTrendDigestConfigFromRaw = (raw: {
  denyKeywords?: string;
  allowCategories?: string;
  maxHardNews?: string;
  maxItems?: string;
}): TrendDigestConfig => {
  const denyKeywords = parseCsvTokens(raw.denyKeywords);
  const allowCategories = parseCsvTokens(raw.allowCategories);
  const maxHardNews = Math.max(0, parsePositiveInt(raw.maxHardNews, DEFAULT_MAX_HARD_NEWS));
  const maxItems = Math.max(1, parsePositiveInt(raw.maxItems, DEFAULT_MAX_ITEMS));

  return {
    denyKeywords: denyKeywords.length > 0 ? denyKeywords : DEFAULT_TREND_DENY_KEYWORDS,
    allowCategories,
    maxHardNews,
    maxItems
  };
};

const matchesDenyKeyword = (haystack: string, denyKeywords: string[]): boolean => {
  return denyKeywords.some((keyword) => keyword.length > 0 && haystack.includes(keyword));
};

const buildDigestItem = (item: TrendDigestSourceItem): TrendDigestItem | null => {
  const cleanedTitle = cleanDigestText(item.title);
  const cleanedSummary = cleanDigestText(item.summary);
  if (!cleanedTitle) return null;

  const whatHappened = ensureSentence(
    summarizeSentences(cleanedSummary, 2) ||
      `${cleanedTitle}が話題になっており、主要な更新点が確認されています。`,
    `${cleanedTitle}が話題になっており、主要な更新点が確認されています。`
  );
  const whyItMatters = resolveWhyItMatters(item.category, cleanedTitle);

  return {
    id: item.id,
    cleanedTitle,
    whatHappened,
    whyItMatters,
    toneTag: resolveToneTag(item.category),
    category: compactText(item.category) || "general",
    source: cleanDigestText(item.source) || "unknown",
    url: compactText(item.url),
    score: item.score,
    publishedAt: item.publishedAt,
    clusterSize: item.clusterSize
  };
};

export const buildTrendDigest = (
  sourceItems: TrendDigestSourceItem[],
  config: TrendDigestConfig
): TrendDigestResult => {
  const filteredBase: TrendDigestItem[] = [];
  let filteredCount = 0;
  const allowCategoriesSet = new Set(config.allowCategories.map(normalizeToken));
  const seenKeys = new Set<string>();

  for (const rawItem of sourceItems) {
    const digestItem = buildDigestItem(rawItem);
    if (!digestItem) {
      filteredCount += 1;
      continue;
    }

    const normalizedCategory = normalizeToken(digestItem.category);
    if (allowCategoriesSet.size > 0 && !allowCategoriesSet.has(normalizedCategory)) {
      filteredCount += 1;
      continue;
    }

    const denyHaystack = normalizeToken(
      `${digestItem.cleanedTitle} ${digestItem.whatHappened} ${digestItem.whyItMatters}`
    );
    if (matchesDenyKeyword(denyHaystack, config.denyKeywords)) {
      filteredCount += 1;
      continue;
    }

    const dedupeKey = `${normalizeToken(digestItem.cleanedTitle)}::${normalizeToken(digestItem.url)}`;
    if (seenKeys.has(dedupeKey)) {
      filteredCount += 1;
      continue;
    }
    seenKeys.add(dedupeKey);
    filteredBase.push(digestItem);
  }

  const sorted = [...filteredBase].sort((left, right) => {
    if (right.score !== left.score) return right.score - left.score;
    if ((right.clusterSize ?? 1) !== (left.clusterSize ?? 1)) {
      return (right.clusterSize ?? 1) - (left.clusterSize ?? 1);
    }
    return (right.publishedAt ?? "").localeCompare(left.publishedAt ?? "");
  });

  const selected: TrendDigestItem[] = [];
  const selectedIds = new Set<string>();
  let hardNewsCount = 0;

  const firstEntertainment = sorted.find((item) =>
    ENTERTAINMENT_CATEGORIES.has(normalizeToken(item.category))
  );
  if (firstEntertainment) {
    selected.push(firstEntertainment);
    selectedIds.add(firstEntertainment.id);
  }

  for (const item of sorted) {
    if (selected.length >= config.maxItems) break;
    if (selectedIds.has(item.id)) continue;

    const isHardNews = HARD_NEWS_CATEGORIES.has(normalizeToken(item.category));
    if (isHardNews && hardNewsCount >= config.maxHardNews) {
      filteredCount += 1;
      continue;
    }

    selected.push(item);
    selectedIds.add(item.id);
    if (isHardNews) {
      hardNewsCount += 1;
    }
  }

  const categoryDistribution: Record<string, number> = {};
  for (const item of selected) {
    const category = normalizeToken(item.category) || "general";
    categoryDistribution[category] = (categoryDistribution[category] ?? 0) + 1;
  }

  return {
    items: selected,
    usedCount: selected.length,
    filteredCount: filteredCount + Math.max(0, sorted.length - selected.length),
    categoryDistribution
  };
};
