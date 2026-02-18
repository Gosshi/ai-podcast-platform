import { failRun, finishRun, startRun } from "../_shared/jobRuns.ts";
import { jsonResponse } from "../_shared/http.ts";
import {
  findJapaneseEpisodeByTitle,
  insertJapaneseEpisode,
  updateEpisode
} from "../_shared/episodes.ts";

type RequestBody = {
  episodeDate?: string;
  idempotencyKey?: string;
  topic?: {
    title?: string;
    bullets?: string[];
  };
  trendItems?: {
    title?: string;
    summary?: string;
    url?: string;
    source?: string;
  }[];
  letters?: {
    display_name?: string;
    text?: string;
  }[];
};

type ScriptTrendItem = {
  title: string;
  summary: string;
  url: string | null;
  source: string;
};

type ScriptLetter = {
  displayName: string;
  text: string;
};

const MAX_TREND_ITEMS = 3;
const MAX_LETTERS = 2;

const fallbackTrend = (index: number): ScriptTrendItem => ({
  title: `補足トレンド ${index}`,
  summary: "公開情報を確認中です。未確認情報は断定せず、事実ベースでお伝えします。",
  url: null,
  source: "確認中"
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
    .map((item) => {
      const title = (item?.title ?? "").trim();
      const summary =
        sanitizeNarrationText(item?.summary ?? "") ||
        `${title}に関する最新トピックです。公開情報ベースで確認します。`;
      const url = (item?.url ?? "").trim() || null;
      const source = resolveSourceName(item?.source, item?.url);
      return { title, summary, url, source };
    });

  while (normalized.length < MAX_TREND_ITEMS) {
    normalized.push(fallbackTrend(normalized.length + 1));
  }

  return normalized;
};

const normalizeLetters = (letters: RequestBody["letters"]): ScriptLetter[] => {
  return (letters ?? [])
    .filter((letter) => Boolean(letter?.display_name && letter?.text))
    .slice(0, MAX_LETTERS)
    .map((letter) => ({
      displayName: (letter?.display_name ?? "").trim(),
      text: (letter?.text ?? "").trim()
    }));
};

const buildJapaneseScript = (params: {
  topicTitle: string;
  bullets: string[];
  trendItems: ScriptTrendItem[];
  letters: ScriptLetter[];
}): string => {
  const opening = `[OPENING]
今日は「${params.topicTitle}」をお届けします。最新トレンドを3本、事実ベースでコンパクトに整理します。
この番組は一般的な情報提供を目的とし、誹謗中傷や断定的な医療・投資助言は行いません。`;

  const trendSections = params.trendItems.map((trend, index) => {
    const bulletHint = params.bullets[index] ? `（関連メモ: ${params.bullets[index]}）` : "";
    return `[TREND ${index + 1}]
トピック: ${trend.title}
- 何が起きた: ${trend.summary}
- なぜ話題: ${trend.title}は直近の反応が大きく、背景理解に役立つ論点が含まれます。${bulletHint}
- ひとこと見解: 断定は避けつつ、一次情報の更新を追いながら実務への示唆を拾っていきましょう。
- 参照メディア: ${trend.source}`;
  });

  const lettersSection =
    params.letters.length === 0
      ? `[LETTERS CORNER]
- 今日はお便りはお休み`
      : `[LETTERS CORNER]
${params.letters
  .map(
    (letter, index) =>
      `- お便り${index + 1}（${letter.displayName}）: ${letter.text}\n- ひとこと返信: メッセージありがとうございます。番組づくりの参考にします。`
  )
  .join("\n")}`;

  const closing = `[CLOSING]
以上、今日のトピック整理でした。気になる話題があれば次回の深掘り候補として取り上げます。`;

  const sources = params.trendItems
    .map((trend) => ({
      source: trend.source,
      title: trend.title
    }))
    .filter((item) => item.title.length > 0);
  const sourceLines =
    sources.length === 0
      ? "- 本日の参照情報は準備中です。"
      : sources.map((item) => `- 媒体名: ${item.source} / タイトル: ${item.title}`).join("\n");
  const sourcesSection = `[SOURCES]
${sourceLines}`;

  const urls = Array.from(new Set(params.trendItems.map((trend) => trend.url).filter(Boolean))) as string[];
  const sourcesForUiSection = `[SOURCES_FOR_UI]
${urls.length === 0 ? "- none" : urls.map((url) => `- ${url}`).join("\n")}`;

  return [
    `# ${params.topicTitle}`,
    opening,
    ...trendSections,
    lettersSection,
    closing,
    sourcesSection,
    sourcesForUiSection
  ].join("\n\n");
};

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "method_not_allowed" }, 405);
  }

  const body = (await req.json().catch(() => ({}))) as RequestBody;
  const episodeDate = body.episodeDate ?? new Date().toISOString().slice(0, 10);
  const idempotencyKey = body.idempotencyKey ?? `daily-${episodeDate}`;
  const topicTitle = body.topic?.title ?? `Staging Topic ${episodeDate}`;
  const bullets = body.topic?.bullets ?? ["MVP progress summary", "Behind the scenes", "Next build targets"];
  const trendItems = normalizeTrendItems(body.trendItems);
  const letters = normalizeLetters(body.letters);
  const title = `${topicTitle} (JA)`;
  const description = `Japanese episode for ${episodeDate}`;
  const script = buildJapaneseScript({ topicTitle, bullets, trendItems, letters });

  const runId = await startRun("write-script-ja", {
    step: "write-script-ja",
    episodeDate,
    idempotencyKey,
    title,
    trendItemsCount: trendItems.length,
    lettersCount: letters.length
  });

  try {
    let episode = await findJapaneseEpisodeByTitle(title);

    if (!episode) {
      episode = await insertJapaneseEpisode({ title, description, script });
    } else if (!episode.script || episode.status === "failed") {
      await updateEpisode(episode.id, { status: "generating" });
      episode = await updateEpisode(episode.id, {
        script,
        description,
        status: "draft"
      });
    }

    await finishRun(runId, {
      step: "write-script-ja",
      episodeDate,
      idempotencyKey,
      episodeId: episode.id,
      status: episode.status,
      noOp: Boolean(episode.script),
      trendItemsCount: trendItems.length,
      lettersCount: letters.length
    });

    return jsonResponse({
      ok: true,
      episodeDate,
      idempotencyKey,
      episodeId: episode.id,
      title: episode.title,
      status: episode.status,
      trendItemsCount: trendItems.length,
      lettersCount: letters.length
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await failRun(runId, message, {
      step: "write-script-ja",
      episodeDate,
      idempotencyKey,
      title,
      trendItemsCount: trendItems.length,
      lettersCount: letters.length
    });

    return jsonResponse({ ok: false, error: message }, 500);
  }
});
