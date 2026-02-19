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

const MAX_TREND_ITEMS = 12;
const MAX_LETTERS = 2;
const MAIN_TOPIC_MIN_CHARS = 520;

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

    const maxSummaryChars = 110;
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

const repeatSentenceUntilMinLength = (base: string, extra: string, minLength: number): string => {
  const sentences = [base.trim()];
  while (sentences.join("").length < minLength) {
    sentences.push(extra);
  }
  return sentences.join("");
};

const buildMainTopicNarration = (
  topic: ProgramPlan["main_topics"][number],
  index: number
): string => {
  const intro =
    `導入: さあメイントピック${index + 1}です。${topic.intro} 最初に、何が起きたかと、なぜ今この話題が伸びているのかを1分でつかみます。`;
  const tsukkomi =
    `ツッコミ: ここで一回ツッコミます。「それ、本当にそこまで言い切れるの？」という目線です。${topic.background} 速報の勢いだけで判断せず、抜け落ちた前提と数字の根拠を拾っていきます。`;
  const impact =
    `展開: ${topic.impact} 現場実装、利用者体験、コスト、ガバナンスの4軸で、明日からどこが先に変わるかを具体化します。`;
  const supplement =
    `補足: ${topic.supplement} 反対意見や未確定情報も同時に扱って、断定を避けつつ解像度を上げる運用に寄せます。`;
  const summary =
    `まとめ: メイントピック${index + 1}は、短期対応と中長期設計を同時に見るのがポイントでした。ここまでを踏まえて、次のニュースにつなげます。`;
  const narrative = [intro, tsukkomi, impact, supplement, summary].join("\n");

  return repeatSentenceUntilMinLength(
    narrative,
    "追加整理: 重要論点を一つずつ再確認し、一次情報の更新が出た時に判断を更新できるよう、前提・根拠・不確実性をセットで記録します。",
    MAIN_TOPIC_MIN_CHARS
  );
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
      durationSecTarget: 30
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

const buildQuickNewsSection = (quickNews: ProgramPlan["quick_news"]): string => {
  const lines = quickNews.map(
    (item, index) =>
      `- クイックニュース${index + 1}（30秒想定）: ${item.title}\n  要約: ${item.summary}\n  出典カテゴリ: ${item.category} / 参照媒体: ${item.source}`
  );
  return `[QUICK NEWS]\n${lines.join("\n")}`;
};

const buildSmallTalkSection = (smallTalk: ProgramPlan["small_talk"]): string => {
  const lines = smallTalk.map(
    (item, index) =>
      `- スモールトーク${index + 1}（${item.mood}）: ${item.title}\n  話しどころ: ${item.talkingPoint}`
  );
  return `[SMALL TALK]\n${lines.join("\n")}`;
};

const buildLettersSection = (letters: ScriptLetter[], hostPrompt: string): string => {
  if (letters.length === 0) {
    return `[LETTERS CORNER]
- 今日はお便りはお休み
- 進行メモ: ${hostPrompt}`;
  }

  return `[LETTERS CORNER]
${letters
  .map((letter, index) => {
    const tipAmount = formatTipAmount(letter.tipAmount, letter.tipCurrency);
    const thanksLine = tipAmount
      ? `- ${letter.displayName}さん、（${tipAmount}）ありがとうございます。\n`
      : "";
    return `${thanksLine}- お便り${index + 1}（${letter.displayName}）: ${letter.summarizedText}\n- 返答方針: ${hostPrompt}`;
  })
  .join("\n")}`;
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
      ? "main_topics"
      : quickTitles.has(item.title)
        ? "quick_news"
        : smallTalkTitles.has(item.title)
          ? "small_talk"
          : "other";
    return `- セクション: ${section} / 媒体名: ${item.source} / カテゴリ: ${item.category} / タイトル: ${item.title}`;
  });

  const referenceLines = uniqueItems.map((item) => {
    return `- trend_item_id: ${item.id}`;
  });

  return {
    sources: `[SOURCES]\n${sourceLines.length === 0 ? "- 本日の参照情報は準備中です。" : sourceLines.join("\n")}`,
    sourceReferences: `[SOURCES_FOR_UI]\n${
      referenceLines.length === 0
        ? "- 元URLはtrend_itemsテーブルを参照してください。"
        : [
            "- 本文からURLは除去済みです。元URLはtrend_itemsテーブルを参照してください。",
            ...referenceLines
          ].join("\n")
    }`
  };
};

const buildJapaneseScript = (params: {
  topicTitle: string;
  programPlan: ProgramPlan;
  trendItems: ScriptTrendItem[];
  letters: ScriptLetter[];
  scriptGate: ScriptGateConfig;
}): { script: string; scriptChars: number; estimatedDurationSec: number } => {
  const opening = `[OPENING]
番組タイトル: ${params.topicTitle}
今夜の進行はラジオ司会者スタイルでお送りします。テンポよく、でも大事なところは丁寧に整理していきます。
今日はメイントピック3本、クイックニュース4本、スモールトーク2本、レターズ、エンディングの順でお届けします。
この番組は一般的な情報提供を目的とし、断定的な医療・投資助言は行いません。`;

  const mainTopicSections = params.programPlan.main_topics.map((topic, index) => {
    const body = buildMainTopicNarration(topic, index);
    return `[MAIN TOPIC ${index + 1}]
見出し: ${topic.title}
カテゴリ: ${topic.category}
参照媒体: ${topic.source}
${body}`;
  });

  const quickNewsSection = buildQuickNewsSection(params.programPlan.quick_news);
  const smallTalkSection = buildSmallTalkSection(params.programPlan.small_talk);
  const lettersSection = buildLettersSection(params.letters, params.programPlan.letters.host_prompt);
  const closing = `[CLOSING]
${params.programPlan.ending.message}
以上、今日の番組でした。最後までありがとうございます。
次回も、導入で全体像を押さえ、ツッコミで論点を磨き、まとめで持ち帰りを残す構成でお届けします。`;
  const { sources, sourceReferences } = buildSourcesSection(params.trendItems, params.programPlan);

  let draft = [
    opening,
    ...mainTopicSections,
    quickNewsSection,
    smallTalkSection,
    lettersSection,
    closing,
    sources,
    sourceReferences
  ].join("\n\n");

  while (draft.length < params.scriptGate.minChars) {
    draft = `${draft}\n\n[CONTENT EXPANSION]\n深掘り補足: 速報性だけでなく、背景・影響・前提条件を繰り返し確認することで、短期的な反応に偏らない理解を目指します。`;
  }

  const normalized = normalizeForSpeech(draft, "ja");
  const scriptChars = normalized.length;
  const estimatedDurationSec = estimateScriptDurationSec(scriptChars, params.scriptGate.charsPerMin);

  return { script: normalized, scriptChars, estimatedDurationSec };
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
  const built = buildJapaneseScript({ topicTitle, trendItems, letters, programPlan, scriptGate });

  const runId = await startRun("write-script-ja", {
    step: "write-script-ja",
    role: "editor-in-chief",
    episodeDate,
    idempotencyKey,
    title,
    trendItemsCount: trendItems.length,
    lettersCount: letters.length,
    scriptChars: built.scriptChars,
    estimatedDurationSec: built.estimatedDurationSec,
    scriptGate
  });

  try {
    let episode = await findJapaneseEpisodeByTitle(title);
    let noOp = false;

    if (!episode) {
      episode = await insertJapaneseEpisode({ title, description, script: built.script });
      episode = await updateEpisode(episode.id, { duration_sec: built.estimatedDurationSec });
    } else if (!episode.script || episode.status === "failed" || episode.script !== built.script) {
      await updateEpisode(episode.id, { status: "generating" });
      episode = await updateEpisode(episode.id, {
        script: built.script,
        description,
        status: "draft",
        duration_sec: built.estimatedDurationSec
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
      scriptChars: built.scriptChars,
      estimatedDurationSec: built.estimatedDurationSec,
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
      scriptChars: built.scriptChars,
      estimatedDurationSec: built.estimatedDurationSec,
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
      scriptChars: built.scriptChars,
      estimatedDurationSec: built.estimatedDurationSec,
      scriptGate
    });

    return jsonResponse({ ok: false, error: message }, 500);
  }
});
