import { failRun, finishRun, startRun } from "../_shared/jobRuns.ts";
import { jsonResponse } from "../_shared/http.ts";
import {
  fetchEpisodeById,
  findEnglishEpisodeByMasterId,
  insertEnglishEpisode,
  updateEpisode
} from "../_shared/episodes.ts";

type RequestBody = {
  episodeDate?: string;
  idempotencyKey?: string;
  masterEpisodeId?: string;
};

const MARKERS = [
  "OPENING",
  "TREND 1",
  "TREND 2",
  "TREND 3",
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

const readField = (text: string, label: string): string | null => {
  const match = text.match(new RegExp(`(?:^|\\n)${label}\\s*:?\\s*(.+)`));
  return match ? match[1].trim() : null;
};

const extractTrendBlock = (text: string): { topic: string; happened: string; why: string; take: string; source: string } => {
  const topic = readField(text, "トピック") ?? "Emerging topic";
  const happened = readField(text, "- 何が起きた") ?? "Recent updates were observed from public reports.";
  const why = readField(text, "- なぜ話題") ?? "The story gained attention because it affects practical decisions.";
  const take = readField(text, "- ひとこと見解") ?? "We track confirmed facts and avoid overconfident conclusions.";
  const source = readField(text, "- 参照メディア") ?? "Source under review";
  return { topic, happened, why, take, source };
};

const extractLetters = (lettersSection: string): { name: string; text: string }[] => {
  if (!lettersSection || lettersSection.includes("今日はお便りはお休み")) {
    return [];
  }

  return lettersSection
    .split(/\r?\n/)
    .map((line) => line.trim())
    .map((line) => line.match(/^- お便り\d*（(.+?)）:\s*(.+)$/))
    .filter((match): match is RegExpMatchArray => Boolean(match))
    .map((match) => ({
      name: match[1].trim(),
      text: match[2].trim()
    }));
};

const extractSourceRows = (sourcesSection: string): { outlet: string; title: string }[] => {
  return sourcesSection
    .split(/\r?\n/)
    .map((line) => line.trim())
    .map((line) => line.match(/^- 媒体名:\s*(.+?)\s*\/\s*タイトル:\s*(.+)$/))
    .filter((match): match is RegExpMatchArray => Boolean(match))
    .map((match) => ({
      outlet: match[1].trim(),
      title: match[2].trim()
    }));
};

const extractUrls = (sourcesForUiSection: string): string[] => {
  const urls = new Set<string>();
  for (const line of sourcesForUiSection.split(/\r?\n/)) {
    const match = line.match(/https?:\/\/\S+/);
    if (match) {
      urls.add(match[0]);
    }
  }
  return Array.from(urls);
};

const normalizeWhitespace = (value: string): string => value.replace(/\s+/g, " ").trim();

const hasJapaneseText = (value: string): boolean => JAPANESE_CHAR_PATTERN.test(value);

const toEnglishSourceLabel = (value: string): string => {
  const normalized = normalizeWhitespace(value);
  if (!normalized) {
    return "Japanese media";
  }

  return hasJapaneseText(normalized) ? "Japanese media" : normalized;
};

const toEnglishTopicLine = (topic: string, source: string, index: number): string => {
  const normalized = normalizeWhitespace(topic);
  if (!normalized || hasJapaneseText(normalized)) {
    return `${source} report: trend story ${index}`;
  }

  return normalized;
};

const toEnglishHappenedLine = (value: string, source: string): string => {
  const normalized = normalizeWhitespace(value);
  if (normalized && !hasJapaneseText(normalized)) {
    return normalized;
  }

  const percent = normalized.match(/(\d+(?:\.\d+)?)\s*%/);
  if (percent) {
    return `${source} reported a change of about ${percent[1]} percent.`;
  }

  const year = normalized.match(/(20\d{2})/);
  if (year) {
    return `${source} reported a notable update in ${year[1]}.`;
  }

  return `${source} reported a notable update in Japanese-language coverage.`;
};

const toEnglishWhyLine = (value: string, source: string): string => {
  const normalized = normalizeWhitespace(value);
  if (normalized && !hasJapaneseText(normalized)) {
    return normalized;
  }

  return `The topic gained traction in Japan and is being tracked by ${source}.`;
};

const toEnglishTakeLine = (value: string): string => {
  const normalized = normalizeWhitespace(value);
  if (normalized && !hasJapaneseText(normalized)) {
    return normalized;
  }

  return "We avoid overconfident claims and keep following verified updates.";
};

const buildEnglishScript = (title: string, sections: Record<Marker, string>): string => {
  const trend1 = extractTrendBlock(sections["TREND 1"]);
  const trend2 = extractTrendBlock(sections["TREND 2"]);
  const trend3 = extractTrendBlock(sections["TREND 3"]);
  const letters = extractLetters(sections["LETTERS CORNER"]);
  const sourceRows = extractSourceRows(sections.SOURCES);
  const urls = extractUrls(sections.SOURCES_FOR_UI);

  const opening = `[OPENING]
Welcome back. This English edition keeps the same structure as the Japanese script while making the flow natural for global listeners.
Today's theme is "${title}" and we focus on confirmed information only.`;

  const trendSections = [trend1, trend2, trend3].map(
    (trend, index) => {
      const source = toEnglishSourceLabel(trend.source);
      return `[TREND ${index + 1}]
Topic: ${toEnglishTopicLine(trend.topic, source, index + 1)}
- What happened: ${toEnglishHappenedLine(trend.happened, source)}
- Why it is trending: ${toEnglishWhyLine(trend.why, source)}
- Quick take: ${toEnglishTakeLine(trend.take)}
- Source context: ${source}`;
    }
  );

  const lettersSection =
    letters.length === 0
      ? `[LETTERS CORNER]
- No listener letters today.`
      : `[LETTERS CORNER]
${letters
  .slice(0, 2)
  .map(
    (letter, index) =>
      `- Letter ${index + 1} from ${letter.name}: ${letter.text}\n- Host reply: Thanks for the message. We'll keep improving the show with your feedback.`
  )
  .join("\n")}`;

  const closing = `[CLOSING]
That's the wrap for today. If you'd like us to cover a topic next time, send us a note and we'll pick it up in a future episode.`;

  const sourcesSection = `[SOURCES]
${
  sourceRows.length === 0
    ? "- Source list is being prepared."
    : sourceRows
        .map((row, index) => {
          const outlet = toEnglishSourceLabel(row.outlet);
          const titleValue = normalizeWhitespace(row.title);
          const title = titleValue && !hasJapaneseText(titleValue)
            ? titleValue
            : `Top story ${index + 1} from Japanese-language coverage`;
          return `- Outlet: ${outlet} / Title: ${title}`;
        })
        .join("\n")
}`;

  const sourcesForUiSection = `[SOURCES_FOR_UI]
${urls.length === 0 ? "- none" : urls.map((url) => `- ${url}`).join("\n")}`;

  return [
    `# ${title}`,
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
