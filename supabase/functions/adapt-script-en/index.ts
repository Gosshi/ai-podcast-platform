import { failRun, finishRun, startRun } from "../_shared/jobRuns.ts";
import { jsonResponse } from "../_shared/http.ts";
import {
  fetchEpisodeById,
  findEnglishEpisodeByMasterId,
  insertEnglishEpisode,
  updateEpisode
} from "../_shared/episodes.ts";
import { normalizeForSpeech } from "../_shared/speechNormalization.ts";

type RequestBody = {
  episodeDate?: string;
  idempotencyKey?: string;
  masterEpisodeId?: string;
};

const MARKERS = [
  "OP",
  "HEADLINE",
  "DEEPDIVE 1",
  "DEEPDIVE 2",
  "DEEPDIVE 3",
  "LETTERS",
  "OUTRO",
  "OPENING",
  "MAIN TOPIC 1",
  "MAIN TOPIC 2",
  "MAIN TOPIC 3",
  "TREND 1",
  "TREND 2",
  "TREND 3",
  "QUICK NEWS",
  "SMALL TALK",
  "LETTERS CORNER",
  "CLOSING",
  "SOURCES",
  "SOURCES_FOR_UI"
] as const;

type Marker = (typeof MARKERS)[number];

const markerSet = new Set<string>(MARKERS);
const JAPANESE_CHAR_PATTERN = /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u;

const parseSections = (script: string | null): Record<Marker, string> => {
  const sections = Object.fromEntries(MARKERS.map((marker) => [marker, ""])) as Record<Marker, string>;
  if (!script) return sections;

  const lines = script.split(/\r?\n/);
  let active: Marker | null = null;
  const buffers = Object.fromEntries(MARKERS.map((marker) => [marker, [] as string[]])) as Record<
    Marker,
    string[]
  >;

  for (const line of lines) {
    const match = line.match(/^\[([^\]]+)\]\s*$/);
    if (match && markerSet.has(match[1])) {
      active = match[1] as Marker;
      continue;
    }

    if (active) {
      buffers[active].push(line);
    }
  }

  for (const marker of MARKERS) {
    sections[marker] = buffers[marker].join("\n").trim();
  }

  return sections;
};

const normalizeWhitespace = (value: string): string => value.replace(/\s+/g, " ").trim();

const hasJapaneseText = (value: string): boolean => JAPANESE_CHAR_PATTERN.test(value);

const readField = (text: string, label: string): string | null => {
  const match = text.match(new RegExp(`(?:^|\\n)${label}\\s*:?\\s*(.+)`));
  return match ? match[1].trim() : null;
};

const toEnglishSourceLabel = (value: string): string => {
  const normalized = normalizeWhitespace(value);
  if (!normalized) {
    return "Japanese media";
  }
  return hasJapaneseText(normalized) ? "Japanese media" : normalized;
};

const toEnglishSentence = (value: string, fallback: string): string => {
  const normalized = normalizeWhitespace(value);
  if (!normalized) return fallback;
  if (hasJapaneseText(normalized)) return fallback;
  return normalized;
};

type MainTopicBlock = {
  title: string;
  category: string;
  source: string;
  intro: string;
  background: string;
  impact: string;
  supplement: string;
};

const extractMainTopicBlock = (text: string, index: number): MainTopicBlock => {
  const title = readField(text, "見出し") ?? `Main topic ${index}`;
  const category = readField(text, "カテゴリ") ?? "general";
  const source = readField(text, "参照媒体") ?? "Japanese media";
  const intro = readField(text, "導入") ?? "We open by framing the key question and scope.";
  const background =
    readField(text, "背景") ??
    readField(text, "要点1") ??
    "We review the timeline and assumptions behind the latest update.";
  const impact = readField(text, "影響") ?? "We break down likely operational and user impact.";
  const point2 = readField(text, "要点2");
  const point3 = readField(text, "要点3");
  const supplement =
    readField(text, "補足") ??
    readField(text, "一言ツッコミ") ??
    readField(text, "まとめ") ??
    "We include uncertainty and alternative interpretations.";
  return {
    title,
    category,
    source,
    intro,
    background,
    impact: point2 || point3 ? [impact, point2, point3].filter(Boolean).join(" ") : impact,
    supplement
  };
};

const extractLegacyTrendBlock = (text: string, index: number): MainTopicBlock => {
  const title = readField(text, "トピック") ?? `Main topic ${index}`;
  const source = readField(text, "- 参照メディア") ?? "Japanese media";
  const intro = `We begin with ${title} and define why this story matters now.`;
  const background =
    readField(text, "- 何が起きた") ?? "Recent updates were observed from public reports.";
  const impact =
    readField(text, "- なぜ話題") ?? "The topic gained traction because practical decisions may change.";
  const supplement =
    readField(text, "- ひとこと見解") ?? "We avoid overconfident claims and track verified updates.";
  return {
    title,
    category: "general",
    source,
    intro,
    background,
    impact,
    supplement
  };
};

const parseQuickNewsLines = (text: string): string[] => {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^-\s*(クイックニュース|QuickNews)\s*\d*/i.test(line))
    .map((line) => line.replace(/^-\s*(クイックニュース|QuickNews)\s*\d*(（[^）]*）)?\s*:?\s*/i, "").trim())
    .filter((line) => line.length > 0);
};

const parseSmallTalkLines = (text: string): string[] => {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^-\s*スモールトーク\d*/.test(line))
    .map((line) => line.replace(/^-\s*スモールトーク\d*（[^）]*）:\s*/, "").trim())
    .filter((line) => line.length > 0);
};

const extractLetters = (lettersSection: string): { name: string; text: string }[] => {
  if (
    !lettersSection ||
    lettersSection.includes("今日はお便りはお休み") ||
    lettersSection.includes("お便りは0通")
  ) {
    return [];
  }

  const oldFormat = lettersSection
    .split(/\r?\n/)
    .map((line) => line.trim())
    .map((line) => line.match(/^- お便り\d*（(.+?)）:\s*(.+)$/))
    .filter((match): match is RegExpMatchArray => Boolean(match))
    .map((match) => ({
      name: match[1].trim(),
      text: match[2].trim()
    }));

  if (oldFormat.length > 0) {
    return oldFormat;
  }

  const lines = lettersSection.split(/\r?\n/).map((line) => line.trim());
  const result: { name: string; text: string }[] = [];
  let currentName = "Listener";

  for (const line of lines) {
    const nameMatch = line.match(/^感謝:\s*(.+?)さん/);
    if (nameMatch) {
      currentName = nameMatch[1].trim();
      continue;
    }

    const bodyMatch = line.match(/^本文要約:\s*(.+)$/);
    if (bodyMatch) {
      result.push({ name: currentName, text: bodyMatch[1].trim() });
    }
  }

  return result;
};

const extractSourceRows = (sourcesSection: string): string[] => {
  return sourcesSection
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "));
};

const buildEnglishScript = (title: string, sections: Record<Marker, string>): string => {
  const deepDiveSections = [1, 2, 3]
    .map((index) => sections[`DEEPDIVE ${index}` as Marker])
    .filter((section) => section.length > 0)
    .map((section, index) => extractMainTopicBlock(section, index + 1));

  const mainTopicSections = [1, 2, 3]
    .map((index) => sections[`MAIN TOPIC ${index}` as Marker])
    .filter((section) => section.length > 0)
    .map((section, index) => extractMainTopicBlock(section, index + 1));

  const mainTopics =
    deepDiveSections.length > 0
      ? deepDiveSections
      : mainTopicSections.length > 0
      ? mainTopicSections
      : [1, 2, 3].map((index) => extractLegacyTrendBlock(sections[`TREND ${index}` as Marker], index));

  const quickNews = parseQuickNewsLines(sections["QUICK NEWS"]);
  const smallTalk = parseSmallTalkLines(sections["SMALL TALK"]);
  const letters = extractLetters(sections.LETTERS || sections["LETTERS CORNER"]);
  const sourceRows = extractSourceRows(sections.SOURCES);

  const opening = `[OPENING]
Welcome back. This English edition follows the editor-in-chief format:
three main topics, quick news briefs, two small-talk segments, letters, and a short ending.
Today's title is "${title}".`;

  const mainTopicBlocks = mainTopics.map((topic, index) => {
    const source = toEnglishSourceLabel(topic.source);
    return `[MAIN TOPIC ${index + 1}]
Headline: ${toEnglishSentence(topic.title, `Main topic ${index + 1}`)}
Category: ${toEnglishSentence(topic.category, "general")}
Source: ${source}
Intro: ${toEnglishSentence(topic.intro, "We frame the topic and define the decision context.")}
Background: ${toEnglishSentence(
      topic.background,
      "We summarize the timeline and assumptions using public information."
    )}
Impact: ${toEnglishSentence(
      topic.impact,
      "We discuss likely effects on operations, users, and governance."
    )}
Supplement: ${toEnglishSentence(
      topic.supplement,
      "We include uncertainty and alternate interpretations instead of overconfident claims."
    )}`;
  });

  const quickNewsSection = `[QUICK NEWS]
${
  quickNews.length === 0
    ? "- No quick news items in this run."
    : quickNews
        .slice(0, 8)
        .map((line, index) => `- Quick news ${index + 1} (about 30 seconds): ${toEnglishSentence(line, "Update in progress.")}`)
        .join("\n")
}`;

  const smallTalkSection = `[SMALL TALK]
${
  smallTalk.length === 0
    ? "- No small-talk segment today."
    : smallTalk
        .slice(0, 2)
        .map((line, index) => `- Small talk ${index + 1}: ${toEnglishSentence(line, "A light listener-facing reflection.")}`)
        .join("\n")
}`;

  const lettersSection =
    letters.length === 0
      ? `[LETTERS CORNER]
- No listener letters today.`
      : `[LETTERS CORNER]
${letters
  .slice(0, 2)
  .map(
    (letter, index) =>
      `- Letter ${index + 1} from ${letter.name}: ${toEnglishSentence(letter.text, "Thanks for your message.")}\n- Host reply: Thank you. We will keep improving the show with your feedback.`
  )
  .join("\n")}`;

  const closing = `[CLOSING]
That wraps today's episode. We will keep tracking verified updates and return with deeper follow-ups next time.`;

  const sourcesSection = `[SOURCES]
${
  sourceRows.length === 0
    ? "- Source list is being prepared."
    : sourceRows.map((row) => toEnglishSentence(row, "Source metadata available in the database.")).join("\n")
}`;

  const referencesSection = `[SOURCES_FOR_UI]
- Script URLs are intentionally removed for speech quality.
- Original URLs remain stored in trend-related database records.`;

  const raw = [
    `TITLE: ${title}`,
    opening,
    ...mainTopicBlocks,
    quickNewsSection,
    smallTalkSection,
    lettersSection,
    closing,
    sourcesSection,
    referencesSection
  ].join("\n\n");

  return normalizeForSpeech(raw, "en");
};

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "method_not_allowed" }, 405);
  }

  const body = (await req.json().catch(() => ({}))) as RequestBody;
  const episodeDate = body.episodeDate ?? new Date().toISOString().slice(0, 10);
  const idempotencyKey = body.idempotencyKey ?? `daily-${episodeDate}`;

  if (!body.masterEpisodeId) {
    return jsonResponse({ ok: false, error: "masterEpisodeId is required" }, 400);
  }

  const runId = await startRun("adapt-script-en", {
    step: "adapt-script-en",
    episodeDate,
    idempotencyKey,
    masterEpisodeId: body.masterEpisodeId
  });

  try {
    const ja = await fetchEpisodeById(body.masterEpisodeId);
    const title = (ja.title ?? `Episode ${episodeDate}`)
      .replace(/\s*\(JA\)\s*$/, "")
      .concat(" (EN)");
    const description = `English adaptation for ${episodeDate}`;
    const parsedSections = parseSections(ja.script);
    const script = buildEnglishScript(title.replace(/\s*\(EN\)\s*$/, ""), parsedSections);

    let en = await findEnglishEpisodeByMasterId(ja.id);

    if (!en) {
      en = await insertEnglishEpisode({
        masterId: ja.id,
        title,
        description,
        script
      });
    } else if (!en.script || en.status === "failed" || en.script !== script) {
      await updateEpisode(en.id, { status: "generating" });
      en = await updateEpisode(en.id, {
        script,
        description,
        status: "draft"
      });
    }

    await finishRun(runId, {
      step: "adapt-script-en",
      episodeDate,
      idempotencyKey,
      masterEpisodeId: ja.id,
      episodeId: en.id,
      status: en.status
    });

    return jsonResponse({
      ok: true,
      episodeDate,
      idempotencyKey,
      masterEpisodeId: ja.id,
      episodeId: en.id,
      status: en.status
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await failRun(runId, message, {
      step: "adapt-script-en",
      episodeDate,
      idempotencyKey,
      masterEpisodeId: body.masterEpisodeId
    });

    return jsonResponse({ ok: false, error: message }, 500);
  }
});
