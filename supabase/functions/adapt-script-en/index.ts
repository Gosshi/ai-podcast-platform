import { failRun, finishRun, startRun } from "../_shared/jobRuns.ts";
import { jsonResponse } from "../_shared/http.ts";
import {
  fetchEpisodeById,
  findEnglishEpisodeByMasterId,
  insertEnglishEpisode,
  updateEpisode
} from "../_shared/episodes.ts";
import {
  assertNoBadTokens,
  sanitizeScriptText
} from "../_shared/scriptSanitizer.ts";
import { normalizeGenre } from "../../../src/lib/genre/allowedGenres.ts";

type RequestBody = {
  episodeDate?: string;
  genre?: string;
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

const sanitizeEnglishText = (value: string): string => {
  const sanitized = sanitizeScriptText(value)
    .replace(/#8217;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
  return sanitized;
};

const toEnglishSentence = (value: string, fallback: string, maxChars = 220): string => {
  const sanitized = sanitizeEnglishText(value);
  if (!sanitized || hasJapaneseText(sanitized)) {
    return fallback;
  }

  const clipped = sanitized.length <= maxChars
    ? sanitized
    : `${sanitized.slice(0, maxChars).trimEnd()}...`;

  if (/[.!?]$/.test(clipped)) {
    return clipped;
  }
  return `${clipped}.`;
};

const readField = (text: string, label: string): string | null => {
  const match = text.match(new RegExp(`(?:^|\\n)${label}\\s*:?\\s*(.+)`));
  return match ? match[1].trim() : null;
};

type MainTopicBlock = {
  title: string;
  category: string;
  intro: string;
  background: string;
  impact: string;
  nextWatch: string;
};

const extractMainTopicBlock = (text: string, index: number): MainTopicBlock => {
  const title = readField(text, "導入") ?? readField(text, "見出し") ?? `Main topic ${index}`;
  const category = readField(text, "カテゴリ") ?? "general";
  const intro = readField(text, "導入") ?? "We frame what changed and why it matters now.";
  const background =
    readField(text, "要点1(何が起きた)") ??
    readField(text, "要点1") ??
    "We summarize the key update using public reports.";
  const impact =
    readField(text, "要点3(生活への影響)") ??
    readField(text, "要点2") ??
    "We explain likely impact on daily usage and workflow decisions.";
  const nextWatch =
    readField(text, "次の注目点") ??
    readField(text, "まとめ") ??
    "We track primary-source updates and avoid overconfident conclusions.";

  return {
    title,
    category,
    intro,
    background,
    impact,
    nextWatch
  };
};

const parseQuickNewsLines = (text: string): string[] => {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const summaryLines = lines
    .filter((line) => /^要約[:：]/.test(line))
    .map((line) => line.replace(/^要約[:：]\s*/, "").trim())
    .filter((line) => line.length > 0);
  if (summaryLines.length > 0) {
    return summaryLines;
  }

  return lines
    .filter((line) => /^クイックニュース\s*\d+/i.test(line) || /^-\s*(クイックニュース|QuickNews)\s*\d*/i.test(line))
    .map((line) =>
      line
        .replace(/^クイックニュース\s*\d+（[^）]*）\s*:?\s*/i, "")
        .replace(/^-\s*(クイックニュース|QuickNews)\s*\d*(（[^）]*）)?\s*:?\s*/i, "")
        .trim()
    )
    .filter((line) => line.length > 0);
};

const extractLetters = (lettersSection: string): { name: string; text: string }[] => {
  if (!lettersSection) {
    return [];
  }

  const lines = lettersSection
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const modern: { name: string; text: string }[] = [];
  let currentName = "Listener";

  for (const line of lines) {
    const letterMatch = line.match(/^レター\d+[:：]\s*(.+)$/);
    if (letterMatch) {
      const candidate = sanitizeEnglishText(letterMatch[1]);
      currentName = candidate && !hasJapaneseText(candidate) ? candidate : "Listener";
      continue;
    }

    const summaryMatch = line.match(/^本文要約[:：]\s*(.+)$/);
    if (summaryMatch) {
      modern.push({
        name: currentName,
        text: summaryMatch[1].trim()
      });
    }
  }

  if (modern.length > 0) {
    return modern;
  }

  return lines
    .map((line) => line.match(/^-\s*お便り\d*（(.+?)）:\s*(.+)$/))
    .filter((match): match is RegExpMatchArray => Boolean(match))
    .map((match) => ({
      name: match[1].trim(),
      text: match[2].trim()
    }));
};

const buildEnglishScript = (title: string, sections: Record<Marker, string>): string => {
  const mainTopics = [1, 2, 3]
    .map((index) => sections[`DEEPDIVE ${index}` as Marker])
    .filter((section) => section.length > 0)
    .map((section, index) => extractMainTopicBlock(section, index + 1));

  const quickNews = parseQuickNewsLines(sections["QUICK NEWS"]);
  const letters = extractLetters(sections.LETTERS || sections["LETTERS CORNER"]);

  const opening = `[OPENING]
Welcome back. This English edition keeps the same structure as the Japanese master script:
opening, headline, three deep dives, six quick updates, letters, and closing.
Today's title is "${toEnglishSentence(title, "Daily update")}".`;

  const mainTopicBlocks = mainTopics.map((topic, index) => {
    return `[MAIN TOPIC ${index + 1}]
Headline: ${toEnglishSentence(topic.title, `Main topic ${index + 1}`)}
Category: ${toEnglishSentence(topic.category, "general")}
Intro: ${toEnglishSentence(topic.intro, "We frame the key update and context.")}
What happened: ${toEnglishSentence(topic.background, "We summarize what changed based on public information.")}
Daily impact: ${toEnglishSentence(topic.impact, "We explain likely impact on audience routines and workflow.")}
Next watchpoint: ${toEnglishSentence(topic.nextWatch, "We keep tracking verified updates and avoid overreach.")}`;
  });

  const quickNewsSection = `[QUICK NEWS]
${
  quickNews.length === 0
    ? "- No quick updates in this run."
    : quickNews
        .slice(0, 6)
        .map((line, index) => `- Quick update ${index + 1} (about 25 seconds): ${toEnglishSentence(line, "Update in progress.")}`)
        .join("\n")
}`;

  const lettersSection =
    letters.length === 0
      ? `[LETTERS CORNER]
- No listener letters today. Please send one question for a future episode.`
      : `[LETTERS CORNER]
${letters
  .slice(0, 2)
  .map(
    (letter, index) =>
      `- Letter ${index + 1} from ${toEnglishSentence(letter.name, "Listener")}: ${toEnglishSentence(letter.text, "Thanks for your message.")}`
  )
  .join("\n")}`;

  const closing = `[CLOSING]
That wraps today's episode. We focused on what changed, why it matters, and what to watch next.`;

  const raw = [
    `TITLE: ${toEnglishSentence(title, "Daily update")}`,
    opening,
    ...mainTopicBlocks,
    quickNewsSection,
    lettersSection,
    closing
  ].join("\n\n");

  const sanitized = sanitizeEnglishText(raw);
  assertNoBadTokens(sanitized, ["<a href", "数式", "アンド#8217;"]);
  if (/https?:\/\//i.test(sanitized) || /\bwww\./i.test(sanitized)) {
    throw new Error("english_script_contains_url");
  }

  return raw
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
};

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "method_not_allowed" }, 405);
  }

  const body = (await req.json().catch(() => ({}))) as RequestBody;
  const episodeDate = body.episodeDate ?? new Date().toISOString().slice(0, 10);
  const requestedGenre =
    typeof body.genre === "string" ? normalizeGenre(body.genre) || "general" : null;
  const idempotencyKey = body.idempotencyKey ?? `daily-${episodeDate}`;

  if (!body.masterEpisodeId) {
    return jsonResponse({ ok: false, error: "masterEpisodeId is required" }, 400);
  }

  const runId = await startRun("adapt-script-en", {
    step: "adapt-script-en",
    episodeDate,
    genre: requestedGenre,
    idempotencyKey,
    masterEpisodeId: body.masterEpisodeId
  });

  try {
    const ja = await fetchEpisodeById(body.masterEpisodeId);
    const genre = requestedGenre ?? (typeof ja.genre === "string" ? normalizeGenre(ja.genre) : "general");
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
        script,
        episodeDate,
        genre
      });
    } else if (!en.script || en.status === "failed" || en.script !== script) {
      await updateEpisode(en.id, { status: "generating" });
      en = await updateEpisode(en.id, {
        script,
        description,
        status: "draft",
        episode_date: episodeDate,
        genre
      });
    }

    await finishRun(runId, {
      step: "adapt-script-en",
      episodeDate,
      genre,
      idempotencyKey,
      masterEpisodeId: ja.id,
      episodeId: en.id,
      status: en.status
    });

    return jsonResponse({
      ok: true,
      episodeDate,
      genre,
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
      genre: requestedGenre,
      idempotencyKey,
      masterEpisodeId: body.masterEpisodeId
    });

    return jsonResponse({ ok: false, error: message }, 500);
  }
});
