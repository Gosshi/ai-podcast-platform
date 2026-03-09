export type JudgmentCard = {
  topic_title: string;
  judgment: string;
  deadline: string | null;
  watch_points: string[];
  frame_type: string | null;
};

const DEEP_DIVE_HEADING_RE = /^\[DEEPDIVE\s+\d+\]\s*$/im;
const SECTION_HEADING_RE = /^\[[^\]]+\]\s*$/gm;
const MAX_CARDS = 3;

const trimLine = (value: string): string => value.replace(/\s+/g, " ").trim();

const readLineValue = (block: string, label: string): string | null => {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = block.match(new RegExp(`(?:^|\\n)${escaped}\\s*(.+)`, "i"));
  return match ? trimLine(match[1]) : null;
};

const normalizeTopicTitle = (value: string | null, fallback: string): string => {
  if (!value) return fallback;
  const normalized = trimLine(
    value
      .replace(/^[:：]/, "")
      .replace(/^DeepDive\d+は/u, "")
      .replace(/^["「]/, "")
      .replace(/["」]。?$/u, "")
  );
  return normalized || fallback;
};

const normalizeWatchPoints = (value: string | null): string[] => {
  if (!value) return [];

  const quoted = Array.from(value.matchAll(/[「"]([^"」]+)[」"]/gu))
    .map((match) => trimLine(match[1]))
    .filter(Boolean);

  if (quoted.length > 0) {
    return quoted.slice(0, 4);
  }

  return value
    .split(/[、,。]/)
    .map((item) => trimLine(item))
    .filter((item) => item.length > 0)
    .slice(0, 4);
};

const readFrameType = (judgment: string | null): string | null => {
  if (!judgment) return null;
  const match = judgment.match(/\b(Frame\s+[A-D])\b/i);
  return match ? match[1].replace(/\s+/g, " ") : null;
};

const splitIntoDeepDiveBlocks = (script: string): string[] => {
  const sections = script.split(SECTION_HEADING_RE);
  const headings = Array.from(script.matchAll(SECTION_HEADING_RE)).map((match) => match[0]);
  const blocks: string[] = [];

  for (let index = 0; index < headings.length; index += 1) {
    if (!DEEP_DIVE_HEADING_RE.test(headings[index] ?? "")) {
      continue;
    }

    const body = sections[index + 1] ?? "";
    blocks.push(body.trim());
  }

  return blocks;
};

export const extractJudgmentCards = (script: string | null | undefined): JudgmentCard[] => {
  if (typeof script !== "string" || !script.trim()) {
    return [];
  }

  return splitIntoDeepDiveBlocks(script)
    .map((block, index) => {
      const topicTitle = normalizeTopicTitle(
        readLineValue(block, "導入:"),
        `DeepDive ${index + 1}`
      );
      const judgment = readLineValue(block, "5. 今日の判断（個人視点）:");
      const deadline = readLineValue(block, "6. 判断期限（個人の行動期限）:");
      const watchPoints = normalizeWatchPoints(
        readLineValue(block, "7. 監視ポイント（個人が見るべき数値）:")
      );

      if (!judgment) {
        return null;
      }

      return {
        topic_title: topicTitle,
        judgment,
        deadline,
        watch_points: watchPoints,
        frame_type: readFrameType(judgment)
      };
    })
    .filter((card): card is JudgmentCard => Boolean(card))
    .slice(0, MAX_CARDS);
};

