import { failRun, finishRun, startRun } from "../_shared/jobRuns.ts";
import { jsonResponse } from "../_shared/http.ts";
import {
  findJapaneseEpisodeByTitle,
  insertJapaneseEpisode,
  updateEpisode
} from "../_shared/episodes.ts";
import {
  PROGRAM_MAIN_TOPICS_COUNT,
  PROGRAM_QUICK_NEWS_COUNT,
  PROGRAM_SMALL_TALK_COUNT,
  type ProgramPlan
} from "../_shared/programPlan.ts";
import { normalizeForSpeech } from "../_shared/speechNormalization.ts";
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
  renderScriptSections,
  type ScriptSection,
  type SectionsCharsBreakdown
} from "../_shared/scriptSections.ts";
import { postEditJapaneseScript } from "../_shared/scriptEditor.ts";

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
  title: string;
  summary: string;
  url: string | null;
  source: string;
  category: string;
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

const MAX_TREND_ITEMS = 12;
const MAX_LETTERS = 2;
const DEEP_DIVE_COUNT = 3;
const QUICK_NEWS_MIN_ITEMS = 5;
const QUICK_NEWS_MAX_ITEMS = 8;

const fallbackTrend = (index: number): ScriptTrendItem => ({
  id: `fallback-${index}`,
  title: `補足トレンド ${index}`,
  summary: "公開情報を確認中です。未確認情報は断定せず、事実ベースでお伝えします。",
  url: null,
  source: "確認中",
  category: "general"
});

const sanitizeNarrationText = (value: string): string => {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/&#45;/g, "-")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
};

const resolveSourceName = (source: string | undefined, url: string | undefined): string => {
  if (source && source.trim().length > 0) {
    return source.trim();
  }

  if (!url) return "出典不明";

  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "出典不明";
  }
};

const ensureSentence = (value: string, fallback: string, maxChars = 160): string => {
  const normalized = sanitizeNarrationText(value) || fallback;
  const clipped = normalized.length <= maxChars
    ? normalized
    : `${normalized.slice(0, maxChars).trimEnd()}…`;

  if (/[。！？!?]$/.test(clipped)) {
    return clipped;
  }
  return `${clipped}。`;
};

const padSection = (body: string, minChars: number, expansions: string[]): string => {
  let padded = body.trim();
  let index = 0;

  while (padded.length < minChars) {
    const expansion = expansions[index % expansions.length] ?? expansions[0] ?? "補足です。";
    padded = `${padded}\n補足${index + 1}: ${expansion}`;
    index += 1;
  }

  return padded;
};

const normalizeTrendItems = (trendItems: RequestBody["trendItems"]): ScriptTrendItem[] => {
  const normalized = (trendItems ?? [])
    .filter((item) => Boolean(item?.title))
    .slice(0, MAX_TREND_ITEMS)
    .map((item, index) => {
      const title = (item?.title ?? "").trim();
      const summary =
        sanitizeNarrationText(item?.summary ?? "") ||
        `${title}に関する最新トピックです。公開情報ベースで確認します。`;
      const url = (item?.url ?? "").trim() || null;
      const source = resolveSourceName(item?.source, item?.url);
      const id = (item?.id ?? "").trim() || `trend-${index + 1}`;
      const category = (item?.category ?? "").trim() || "general";
      return { id, title, summary, url, source, category };
    });

  while (normalized.length < MAX_TREND_ITEMS) {
    normalized.push(fallbackTrend(normalized.length + 1));
  }

  return normalized;
};

const normalizeLetters = (letters: RequestBody["letters"]): ScriptLetter[] => {
  const summarizeLetterText = (text: string): string => {
    const sanitized = sanitizeNarrationText(text);
    if (!sanitized) {
      return "応援メッセージをいただきました。";
    }

    const maxSummaryChars = 130;
    return sanitized.length <= maxSummaryChars
      ? sanitized
      : `${sanitized.slice(0, maxSummaryChars).trimEnd()}…`;
  };

  return (letters ?? [])
    .filter((letter) => Boolean(letter?.display_name && letter?.text))
    .slice(0, MAX_LETTERS)
    .map((letter) => ({
      displayName: (letter?.display_name ?? "").trim(),
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

const buildFallbackProgramPlan = (topicTitle: string, trendItems: ScriptTrendItem[]): ProgramPlan => {
  const mainTopics = trendItems.slice(0, PROGRAM_MAIN_TOPICS_COUNT).map((trend, index) => ({
    title: trend.title || `${topicTitle} 補足 ${index + 1}`,
    source: trend.source,
    category: trend.category,
    intro: `${trend.title}について、導入で論点の全体像を確認します。`,
    background: `${trend.summary} 背景では公開情報の時系列と前提を確認します。`,
    impact: "影響では、利用者と実務の両面で生じる変化を整理します。",
    supplement: "補足では、反証可能性や未確定情報を明示して誤読を避けます。"
  }));
  const quickNews = trendItems
    .slice(PROGRAM_MAIN_TOPICS_COUNT, PROGRAM_MAIN_TOPICS_COUNT + PROGRAM_QUICK_NEWS_COUNT)
    .map((trend) => ({
      title: trend.title,
      source: trend.source,
      category: trend.category,
      summary: trend.summary,
      durationSecTarget: 35
    }));
  const smallTalk = trendItems
    .slice(
      PROGRAM_MAIN_TOPICS_COUNT + PROGRAM_QUICK_NEWS_COUNT,
      PROGRAM_MAIN_TOPICS_COUNT + PROGRAM_QUICK_NEWS_COUNT + PROGRAM_SMALL_TALK_COUNT
    )
    .map((trend, index) => ({
      title: trend.title,
      mood: index % 2 === 0 ? "calm" : "light",
      talkingPoint: `${trend.summary} をきっかけに、リスナーと距離の近い視点で会話します。`
    }));

  return {
    role: "editor-in-chief",
    main_topics: mainTopics,
    quick_news: quickNews,
    small_talk: smallTalk,
    letters: {
      host_prompt:
        "お便りには感謝を伝えた上で、断定を避け、次の行動に繋がる短い提案を添えて回答します。"
    },
    ending: {
      message: "本編で扱った論点の再確認と、次回の予告を一言で締めます。"
    }
  };
};

const ensureProgramPlan = (
  plan: ProgramPlan | undefined,
  topicTitle: string,
  trendItems: ScriptTrendItem[]
): ProgramPlan => {
  const fallback = buildFallbackProgramPlan(topicTitle, trendItems);
  if (!plan || plan.role !== "editor-in-chief") {
    return fallback;
  }

  return {
    role: "editor-in-chief",
    main_topics: [...plan.main_topics, ...fallback.main_topics].slice(0, PROGRAM_MAIN_TOPICS_COUNT),
    quick_news: [...plan.quick_news, ...fallback.quick_news].slice(0, PROGRAM_QUICK_NEWS_COUNT),
    small_talk: [...plan.small_talk, ...fallback.small_talk].slice(0, PROGRAM_SMALL_TALK_COUNT),
    letters: plan.letters ?? fallback.letters,
    ending: plan.ending ?? fallback.ending
  };
};

const buildQuickNewsItems = (
  quickNews: ProgramPlan["quick_news"],
  trendItems: ScriptTrendItem[],
  mainTopics: ProgramPlan["main_topics"]
): ProgramPlan["quick_news"] => {
  const mainTopicTitles = new Set(mainTopics.map((topic) => topic.title));
  const usedTitles = new Set<string>();
  const result: ProgramPlan["quick_news"] = [];

  for (const item of quickNews) {
    const title = item.title.trim();
    if (!title || usedTitles.has(title)) continue;
    usedTitles.add(title);
    result.push(item);
  }

  for (const trend of trendItems) {
    if (result.length >= QUICK_NEWS_MAX_ITEMS) break;
    if (mainTopicTitles.has(trend.title)) continue;
    if (usedTitles.has(trend.title)) continue;

    usedTitles.add(trend.title);
    result.push({
      title: trend.title,
      source: trend.source,
      category: trend.category,
      summary: trend.summary,
      durationSecTarget: 35
    });
  }

  while (result.length < QUICK_NEWS_MIN_ITEMS) {
    const fallbackIndex = result.length + 1;
    result.push({
      title: `補足ニュース ${fallbackIndex}`,
      source: "編集部メモ",
      category: "general",
      summary: "ここは速報ではなく背景確認の時間です。断定を避け、明日更新される可能性も添えて整理します。",
      durationSecTarget: 35
    });
  }

  return result.slice(0, QUICK_NEWS_MAX_ITEMS);
};

const buildOp = (topicTitle: string, quickNewsCount: number, lettersCount: number): string => {
  const base = [
    `番組名: ${topicTitle}`,
    "OPです。今日も日本語で、テンポよく整理していきます。",
    "最初に全体像をつかみます。次に深掘りを3本。続けてクイックニュース。最後にレターズとOutroです。",
    `QuickNewsは${quickNewsCount}本です。Lettersは${lettersCount > 0 ? `${lettersCount}通` : "募集と想定質問"}で進めます。`,
    "速報の勢いに流されず、事実と仮説を分けて話します。リンクは概要欄にまとめています。"
  ].join("\n");

  return padSection(base, 380, [
    "聞きながらメモしやすいように、1トピックごとに結論を短く言い切ってから補足に入ります。",
    "断定しにくい話題は、前提条件を先に置いてから解釈を重ねます。"
  ]);
};

const buildHeadline = (programPlan: ProgramPlan, quickNewsCount: number): string => {
  const topLines = programPlan.main_topics.slice(0, DEEP_DIVE_COUNT).map((topic, index) => {
    return `- Headline ${index + 1}: ${ensureSentence(topic.title, `注目テーマ${index + 1}`)}`;
  });

  const base = [
    "Headlineです。今日の地図を30秒で確認します。",
    ...topLines,
    `- QuickNewsの本数: ${quickNewsCount}本。短く回して、深掘りとの差をはっきり出します。`,
    "- レターズ: 最後に1〜2通。質問がない日は募集メッセージと想定質問で埋めます。",
    "このあと、各DeepDiveは導入、要点3つ、ツッコミ、まとめの順で進めます。"
  ].join("\n");

  return padSection(base, 620, [
    "全体像を先に置くことで、途中参加でも話題の位置関係が崩れません。",
    "ここで挙げる順番は、影響範囲と更新頻度のバランスで決めています。"
  ]);
};

const buildDeepDive = (
  topic: ProgramPlan["main_topics"][number],
  index: number,
  trendHint: ScriptTrendItem | undefined
): string => {
  const intro = ensureSentence(
    topic.intro,
    `${topic.title}の今を確認します。何が変わったのかを最初に押さえます。`,
    190
  );
  const point1 = ensureSentence(
    topic.background,
    "要点1は背景です。時系列で見ると、判断に必要な前提が見えてきます。",
    190
  );
  const point2 = ensureSentence(
    topic.impact,
    "要点2は影響です。ユーザー体験、運用コスト、現場の意思決定を順に見ます。",
    190
  );
  const point3 = ensureSentence(
    topic.supplement,
    "要点3は補足です。反証や未確定要素を一緒に置いて、過剰な断定を避けます。",
    190
  );
  const tsukkomi = ensureSentence(
    `${topic.title}を巡る空気感には勢いがあります。ただ、数字の定義と比較対象が曖昧なまま拡散されると誤読が起きます。`,
    "ここで一言ツッコミです。早い結論ほど、前提確認を増やした方が安全です。",
    190
  );
  const summary = ensureSentence(
    `まとめです。${topic.title}は、短期の反応だけでなく中期の運用設計まで含めて見るのが要点でした。`,
    "まとめです。判断を急ぎすぎず、更新を前提に追う姿勢が今日の持ち帰りです。",
    200
  );

  const trendSupplement = trendHint
    ? ensureSentence(
        `${trendHint.title}の文脈も合わせると、同じ論点でも見出しだけでは温度差が読めません。背景の差分まで見る必要があります。`,
        "関連トレンドを照合すると、似た見出しでも前提が異なるケースが見つかります。",
        180
      )
    : "";

  const base = [
    `見出し: ${ensureSentence(topic.title, `DeepDive ${index + 1}`)}`,
    `カテゴリ: ${ensureSentence(topic.category, "general")}`,
    `参照媒体: ${ensureSentence(topic.source, "公開ソース")}`,
    `導入: ${intro}`,
    `要点1: ${point1}`,
    `要点2: ${point2}`,
    `要点3: ${point3}`,
    `一言ツッコミ: ${tsukkomi}`,
    trendSupplement ? `背景補足: ${trendSupplement}` : "",
    `まとめ: ${summary}`
  ]
    .filter((line) => line.length > 0)
    .join("\n");

  return padSection(base, 980, [
    "具体例として、導入時の期待値と実装後の運用負荷がずれる場面を先に想定しておくと、判断ミスを減らせます。",
    "比喩で言えば、地図だけ見て登山するより、天候と装備を確認してから歩く方が安全です。",
    "最後に短い振り返りを入れておくと、次の更新が来たときに差分を追いやすくなります。"
  ]);
};

const buildQuickNewsSection = (quickNews: ProgramPlan["quick_news"]): string => {
  const lines = quickNews.map((item, index) => {
    const title = ensureSentence(item.title, `クイックニュース${index + 1}`, 96);
    const summary = ensureSentence(item.summary, "公開情報の更新がありました。", 140);
    const source = ensureSentence(item.source, "公開ソース", 80);
    const category = ensureSentence(item.category, "general", 80);

    return [
      `- QuickNews ${index + 1}（約35秒）`,
      `  見出し: ${title}`,
      `  要点: ${summary}`,
      `  出典カテゴリ: ${category} / 参照媒体: ${source}`,
      "  ひとこと: 詳細リンクは概要欄にあります。ここでは要点だけ短く確認します。"
    ].join("\n");
  });

  const base = [
    "QuickNewsです。ここはテンポ優先でいきます。",
    ...lines,
    "以上、QuickNewsでした。深掘りとの温度差を意識して、ここで一度頭を整理します。"
  ].join("\n");

  return padSection(base, 980, [
    "短い枠でも、事実と見解を分けるだけで聞きやすさが上がります。",
    "見出しをそのまま読まず、背景を一言添えると誤解が減ります。"
  ]);
};

const buildLettersSection = (letters: ScriptLetter[], hostPrompt: string): string => {
  if (letters.length === 0) {
    const base = [
      "今日は実際のお便りは0通です。",
      "募集: 最近のエピソードで、もっと深掘りしてほしいテーマを教えてください。",
      "想定質問: 情報が更新され続ける話題を、どの時点で判断すべきですか。",
      "回答: まず締切を置きます。次に一次情報の更新を待つ条件を決めます。最後に、誤りが出たら即修正する前提で公開します。",
      `進行メモ: ${ensureSentence(hostPrompt, "短く感謝を伝え、次の行動につながる返答にする。", 140)}`
    ].join("\n");

    return padSection(base, 620, [
      "もう一つの想定質問です。話題が多すぎる日は、重要度と期限で優先順位を切るのが実務的です。",
      "募集告知は毎回同じでも、回答例を変えるとリスナーが送りやすくなります。"
    ]);
  }

  const lines = letters.map((letter, index) => {
    const tipAmount = formatTipAmount(letter.tipAmount, letter.tipCurrency);
    const thanksLine = tipAmount
      ? `感謝: ${letter.displayName}さん、${tipAmount}のサポートありがとうございます。`
      : `感謝: ${letter.displayName}さん、お便りありがとうございます。`;

    return [
      `- レター${index + 1}`,
      `  ${thanksLine}`,
      `  本文要約: ${ensureSentence(letter.summarizedText, "応援のメッセージをいただきました。", 170)}`,
      "  返答: 結論を先に短く伝えます。次に根拠を一つ。最後に次のアクションを一つ提案します。"
    ].join("\n");
  });

  const base = [
    "Lettersです。",
    ...lines,
    `進行メモ: ${ensureSentence(hostPrompt, "断定を避け、行動につながる答えを返す。", 140)}`
  ].join("\n");

  return padSection(base, 640, [
    "回答は長くしすぎず、聞き終わった直後に実行できる一歩を残します。",
    "意見が割れるテーマは、判断軸を二つ提示してリスナー側で選べる形にします。"
  ]);
};

const buildOutro = (endingMessage: string): string => {
  const base = [
    "Outroです。",
    ensureSentence(
      endingMessage,
      "今日は、導入で全体像を押さえ、DeepDiveで論点を深め、QuickNewsで更新を確認しました。"
    ),
    "明日も同じ形式で、更新差分を追っていきます。",
    "リンクは概要欄にまとめています。ここでは読み上げず、耳で追いやすい形を優先しました。",
    "最後までありがとうございます。"
  ].join("\n");

  return padSection(base, 360, [
    "聞き逃したポイントは、DeepDiveのまとめ行だけ追えば要点を再確認できます。"
  ]);
};

const buildSourcesSection = (
  trendItems: ScriptTrendItem[],
  programPlan: ProgramPlan
): { sources: string; sourceReferences: string } => {
  const mainTitles = new Set(programPlan.main_topics.map((item) => item.title));
  const quickTitles = new Set(programPlan.quick_news.map((item) => item.title));
  const smallTalkTitles = new Set(programPlan.small_talk.map((item) => item.title));

  const uniqueItems = trendItems.filter(
    (item, index, all) => all.findIndex((candidate) => candidate.id === item.id) === index
  );
  const sourceLines = uniqueItems.map((item) => {
    const section = mainTitles.has(item.title)
      ? "deepdive"
      : quickTitles.has(item.title)
        ? "quicknews"
        : smallTalkTitles.has(item.title)
          ? "small_talk"
          : "other";
    return `- セクション: ${section} / 媒体名: ${item.source} / カテゴリ: ${item.category} / タイトル: ${item.title}`;
  });

  const referenceLines = uniqueItems.map((item) => {
    return `- trend_item_id: ${item.id}`;
  });

  return {
    sources: sourceLines.length === 0 ? "- 本日の参照情報は準備中です。" : sourceLines.join("\n"),
    sourceReferences:
      referenceLines.length === 0
        ? "- 元URLはtrend_itemsテーブルを参照してください。"
        : [
            "- 本文からURLは除去済みです。元URLはtrend_itemsテーブルを参照してください。",
            ...referenceLines
          ].join("\n")
  };
};

const buildJapaneseScript = (params: {
  topicTitle: string;
  programPlan: ProgramPlan;
  trendItems: ScriptTrendItem[];
  letters: ScriptLetter[];
  scriptGate: ScriptGateConfig;
}): ScriptBuildResult => {
  const deepDiveTopics = params.programPlan.main_topics.slice(0, DEEP_DIVE_COUNT);
  const quickNewsItems = buildQuickNewsItems(
    params.programPlan.quick_news,
    params.trendItems,
    deepDiveTopics
  );

  const deepDiveSections = deepDiveTopics.map((topic, index) => {
    const trendHint = params.trendItems[index + 1];
    return {
      heading: `DEEPDIVE ${index + 1}`,
      body: buildDeepDive(topic, index, trendHint)
    } satisfies ScriptSection;
  });

  const { sources, sourceReferences } = buildSourcesSection(params.trendItems, params.programPlan);

  const sectionBlocks: ScriptSection[] = [
    {
      heading: "OP",
      body: buildOp(params.topicTitle, quickNewsItems.length, params.letters.length)
    },
    {
      heading: "HEADLINE",
      body: buildHeadline(params.programPlan, quickNewsItems.length)
    },
    ...deepDiveSections,
    {
      heading: "QUICK NEWS",
      body: buildQuickNewsSection(quickNewsItems)
    },
    {
      heading: "LETTERS",
      body: buildLettersSection(params.letters, params.programPlan.letters.host_prompt)
    },
    {
      heading: "OUTRO",
      body: buildOutro(params.programPlan.ending.message)
    },
    {
      heading: "SOURCES",
      body: sources
    },
    {
      heading: "SOURCES_FOR_UI",
      body: sourceReferences
    }
  ];

  let draft = renderScriptSections(sectionBlocks);
  let normalized = normalizeForSpeech(draft, "ja");

  let bonusIndex = 1;
  while (normalized.length < params.scriptGate.targetChars) {
    draft =
      `${draft}\n\n[BONUS SUMMARY ${bonusIndex}]` +
      "\n追加の本編補足です。具体例、比喩、背景補足を短く重ねて、今日の判断軸をもう一度整理します。" +
      "\n明日の更新が来たときに差分を追いやすいよう、結論より前提条件を優先してメモしておきましょう。";
    normalized = normalizeForSpeech(draft, "ja");
    bonusIndex += 1;
  }

  if (normalized.length > params.scriptGate.maxChars) {
    normalized = normalized.slice(0, params.scriptGate.maxChars).trimEnd();
  }

  const finalNormalization = normalizeScriptText(normalized);
  const finalScript = finalNormalization.text;
  const scriptChars = finalScript.length;
  const estimatedDurationSec = estimateScriptDurationSec(scriptChars, params.scriptGate.charsPerMin);
  const sectionsCharsBreakdown = buildSectionsCharsBreakdown(finalScript);

  return {
    script: finalScript,
    scriptChars,
    estimatedDurationSec,
    sectionsCharsBreakdown,
    itemsUsedCount: {
      deepdive: deepDiveSections.length,
      quicknews: quickNewsItems.length,
      letters: params.letters.length
    },
    normalizationMetrics: finalNormalization.metrics
  };
};

const resolveTopicTitle = (rawTitle: string | undefined, episodeDate: string): string => {
  const normalized = (rawTitle ?? "").trim();
  if (!normalized) {
    return `Daily Topic ${episodeDate}`;
  }

  if (/^staging topic\b/i.test(normalized)) {
    return `Daily Topic ${episodeDate}`;
  }

  return normalized;
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
  const letters = normalizeLetters(body.letters);
  const programPlan = ensureProgramPlan(body.programPlan, topicTitle, trendItems);
  const scriptGate = resolveScriptGateConfig();
  const title = `Daily Topic ${episodeDate} (JA)`;
  const description = `Japanese episode for ${episodeDate}`;
  const drafted = buildJapaneseScript({ topicTitle, trendItems, letters, programPlan, scriptGate });
  const editorResult = await postEditJapaneseScript(drafted.script);
  const finalScript = editorResult.script;
  const finalScriptChars = finalScript.length;
  const finalEstimatedDurationSec = estimateScriptDurationSec(finalScriptChars, scriptGate.charsPerMin);
  const finalSectionsCharsBreakdown = buildSectionsCharsBreakdown(finalScript);
  const normalizationMetrics = editorResult.edited
    ? editorResult.normalizationMetrics
    : drafted.normalizationMetrics;

  const runId = await startRun("write-script-ja", {
    step: "write-script-ja",
    role: "editor-in-chief",
    episodeDate,
    idempotencyKey,
    title,
    trendItemsCount: trendItems.length,
    lettersCount: letters.length,
    scriptChars: finalScriptChars,
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
    expand_attempted: 0,
    items_used_count: drafted.itemsUsedCount,
    scriptGate
  });

  try {
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
      step: "write-script-ja",
      role: "editor-in-chief",
      episodeDate,
      idempotencyKey,
      episodeId: episode.id,
      status: episode.status,
      noOp,
      trendItemsCount: trendItems.length,
      lettersCount: letters.length,
      scriptChars: finalScriptChars,
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
      expand_attempted: 0,
      items_used_count: drafted.itemsUsedCount,
      scriptGate
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
      expand_attempted: 0,
      items_used_count: drafted.itemsUsedCount,
      scriptGate
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await failRun(runId, message, {
      step: "write-script-ja",
      role: "editor-in-chief",
      episodeDate,
      idempotencyKey,
      title,
      trendItemsCount: trendItems.length,
      lettersCount: letters.length,
      scriptChars: finalScriptChars,
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
      expand_attempted: 0,
      items_used_count: drafted.itemsUsedCount,
      scriptGate
    });

    return jsonResponse({ ok: false, error: message }, 500);
  }
});
