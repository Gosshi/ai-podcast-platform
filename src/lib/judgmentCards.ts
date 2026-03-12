export type JudgmentType = "use_now" | "watch" | "skip";

export type JudgmentThresholdEntry = {
  raw: string;
  value: number;
  unit: string;
  label?: string;
  currency?: string;
};

export type JudgmentThresholdJson = {
  price?: JudgmentThresholdEntry[];
  time_limit?: JudgmentThresholdEntry[];
  unit_cost?: JudgmentThresholdEntry[];
  ratio?: JudgmentThresholdEntry[];
  other?: string[];
};

export type JudgmentCard = {
  id?: string;
  episode_id?: string;
  lang?: "ja" | "en";
  genre?: string | null;
  topic_order: number;
  topic_title: string;
  frame_type: string | null;
  judgment_type: JudgmentType;
  judgment_summary: string;
  action_text: string | null;
  deadline_at: string | null;
  threshold_json: JudgmentThresholdJson;
  watch_points: string[];
  confidence_score: number | null;
};

type ScriptSection = {
  heading: string;
  body: string;
};

const SECTION_HEADING_RE = /^\[[^\]]+\]\s*$/gm;
const SECTION_HEADING_CAPTURE_RE = /^\[([^\]]+)\]\s*$/gm;
const MAX_CARDS = 3;
const SUMMARY_HINT_RE =
  /(今日は|今は|現時点では|まずは|継続|見送|監視|比較|切り替|維持|購入|使う|保留|skip|watch|use now|buy|switch|keep)/i;
const CLEANUP_PROMPT_RE = /(あなたはどうするか。?|What do you do\??)$/i;

const trimLine = (value: string): string => value.replace(/\s+/g, " ").trim();

const readLineValue = (block: string, labels: string[]): string | null => {
  for (const label of labels) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = block.match(new RegExp(`(?:^|\\n)${escaped}\\s*(.+)`, "im"));
    if (match) {
      return trimLine(match[1]);
    }
  }

  return null;
};

const normalizeTopicTitle = (value: string | null, fallback: string): string => {
  if (!value) return fallback;

  const normalized = trimLine(
    value
      .replace(/^[:：]/, "")
      .replace(/^DeepDive\d+は/u, "")
      .replace(/^Main topic \d+\s*:?\s*/iu, "")
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
    return Array.from(new Set(quoted)).slice(0, 5);
  }

  return Array.from(
    new Set(
      value
        .split(/[、,。;]/)
        .map((item) => trimLine(item))
        .filter((item) => item.length > 0)
    )
  ).slice(0, 5);
};

const readFrameType = (text: string | null): string | null => {
  if (!text) return null;
  const match = text.match(/\b(Frame\s+[A-D])\b/i);
  return match ? match[1].replace(/\s+/g, " ") : null;
};

const splitIntoSections = (script: string): ScriptSection[] => {
  const sections = script.split(SECTION_HEADING_RE);
  const headings = Array.from(script.matchAll(SECTION_HEADING_CAPTURE_RE)).map((match) => match[1] ?? "");
  const result: ScriptSection[] = [];

  for (let index = 0; index < headings.length; index += 1) {
    result.push({
      heading: headings[index] ?? "",
      body: (sections[index + 1] ?? "").trim()
    });
  }

  return result;
};

const isJudgmentSection = (heading: string): boolean => {
  return /^(DEEPDIVE|MAIN TOPIC)\s+\d+$/i.test(heading.trim());
};

const parseJstDate = (value: string): string | null => {
  const match = value.match(/(\d{4})年(\d{1,2})月(\d{1,2})日(?:\s*(\d{1,2})時(\d{1,2})分?)?/u);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4] ?? "23");
  const minute = Number(match[5] ?? "59");

  if ([year, month, day, hour, minute].some((part) => !Number.isFinite(part))) {
    return null;
  }

  const iso = new Date(Date.UTC(year, month - 1, day, hour - 9, minute));
  return Number.isNaN(iso.getTime()) ? null : iso.toISOString();
};

const parseEnglishDate = (value: string): string | null => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed.toISOString();
};

const parseDeadlineAt = (value: string | null): string | null => {
  if (!value) return null;
  return parseJstDate(value) ?? parseEnglishDate(value);
};

const splitSentences = (value: string): string[] => {
  return value
    .replace(/\s+/g, " ")
    .replace(/([。.!?])/g, "$1\n")
    .split(/\n+/)
    .map((sentence) => trimLine(sentence.replace(CLEANUP_PROMPT_RE, "")))
    .filter(Boolean);
};

const buildSummaryFromSentence = (sentence: string): string => {
  const normalized = sentence
    .replace(/^Frame\s+[A-D][^。.!?]*[。.!?]\s*/i, "")
    .replace(/^結論は/u, "")
    .trim();

  const tail =
    normalized.split(/(?:なので、|ため、|ので、|結果、|したがって、|therefore,|so,)/i).pop()?.trim() ??
    normalized;

  if (SUMMARY_HINT_RE.test(tail)) {
    return tail;
  }

  return normalized;
};

const detectJudgmentType = (primary: string, fallback = ""): JudgmentType => {
  const normalized = primary.toLowerCase();
  const fallbackNormalized = fallback.toLowerCase();

  if (/(検討継続|監視|様子見|再評価|比較|保留|monitor|watch|revisit|keep tracking|compare)/i.test(normalized)) {
    return "watch";
  }

  if (
    /(見送|今使わない|買わない|契約しない|追加契約を実行しない|停止候補|支払いを保留|skip|hold off|do not|don't|cancel)/i.test(
      normalized
    )
  ) {
    return "skip";
  }

  if (/(今使う|使う|購入|切り替|維持|実行|継続する|use now|buy|switch|keep|renew)/i.test(normalized)) {
    return "use_now";
  }

  if (
    /(見送|今使わない|買わない|契約しない|追加契約を実行しない|停止候補|支払いを保留|skip|hold off|do not|don't|cancel)/i.test(
      fallbackNormalized
    )
  ) {
    return "skip";
  }

  if (/(検討継続|監視|様子見|再評価|比較|保留|monitor|watch|revisit|keep tracking|compare)/i.test(fallbackNormalized)) {
    return "watch";
  }

  if (/(今使う|使う|購入|切り替|維持|実行|継続する|use now|buy|switch|keep|renew)/i.test(fallbackNormalized)) {
    return "use_now";
  }

  return "watch";
};

const collectUniqueEntries = (
  text: string,
  regex: RegExp,
  map: (match: RegExpMatchArray) => JudgmentThresholdEntry
): JudgmentThresholdEntry[] => {
  const results = Array.from(text.matchAll(regex)).map(map);
  const deduped = new Map<string, JudgmentThresholdEntry>();

  for (const entry of results) {
    deduped.set(entry.raw, entry);
  }

  return Array.from(deduped.values());
};

const collectOtherThresholds = (value: string): string[] => {
  return Array.from(
    new Set(
      splitSentences(value).filter((sentence) =>
        /(以下|以上|未満|超|下回|上回|候補|検討|見送|買わない|切り替|保留|固定|更新|戻す|monitor|watch|skip|switch|buy)/i.test(
          sentence
        )
      )
    )
  ).slice(0, 5);
};

const buildThresholdJson = (value: string, watchPoints: string[]): JudgmentThresholdJson => {
  const combined = [value, ...watchPoints].join(" ");
  const price = collectUniqueEntries(
    combined,
    /((?:価格|月額|差額)?\s*[0-9][0-9,]*(?:\.[0-9]+)?\s*円)/g,
    (match) => ({
      raw: trimLine(match[1]),
      value: Number(match[1].replace(/[^\d.]/g, "")),
      unit: "JPY",
      currency: "JPY"
    })
  );
  const timeLimit = collectUniqueEntries(
    combined,
    /((?:予想プレイ時間|月間視聴時間|広告時間)?\s*[0-9][0-9,]*(?:\.[0-9]+)?\s*(時間|分|日))/g,
    (match) => ({
      raw: trimLine(match[1]),
      value: Number(match[1].replace(/[^\d.]/g, "")),
      unit: match[2] === "分" ? "minute" : match[2] === "日" ? "day" : "hour"
    })
  );
  const unitCost = Array.from(
    new Map(
      [
        ...collectUniqueEntries(
          combined,
          /(([0-9][0-9,]*(?:\.[0-9]+)?)\s*円\s*\/\s*(時間|分|日))/g,
          (match) => ({
            raw: trimLine(match[1]),
            value: Number(match[2].replace(/,/g, "")),
            unit: match[3] === "分" ? "JPY_PER_MINUTE" : match[3] === "日" ? "JPY_PER_DAY" : "JPY_PER_HOUR",
            currency: "JPY"
          })
        ),
        ...collectUniqueEntries(
          combined,
          /((?:1時間単価|時間単価|cost per hour)\s*(?:は|=)?\s*([0-9][0-9,]*(?:\.[0-9]+)?)\s*円)/gi,
          (match) => ({
            raw: trimLine(match[1]),
            value: Number(match[2].replace(/,/g, "")),
            unit: "JPY_PER_HOUR",
            currency: "JPY"
          })
        )
      ].map((entry) => [entry.raw, entry])
    ).values()
  );
  const ratio = collectUniqueEntries(
    combined,
    /(([0-9][0-9,]*(?:\.[0-9]+)?)\s*%)/g,
    (match) => ({
      raw: trimLine(match[1]),
      value: Number(match[2].replace(/,/g, "")),
      unit: "PERCENT"
    })
  );
  const other = collectOtherThresholds(value);

  const thresholdJson: JudgmentThresholdJson = {};
  if (price.length > 0) thresholdJson.price = price;
  if (timeLimit.length > 0) thresholdJson.time_limit = timeLimit;
  if (unitCost.length > 0) thresholdJson.unit_cost = unitCost;
  if (ratio.length > 0) thresholdJson.ratio = ratio;
  if (other.length > 0) thresholdJson.other = other;
  return thresholdJson;
};

const computeConfidenceScore = (params: {
  summary: string;
  actionText: string | null;
  deadlineAt: string | null;
  watchPoints: string[];
  frameType: string | null;
  thresholdJson: JudgmentThresholdJson;
}): number => {
  let score = 0.55;

  if (params.summary) score += 0.12;
  if (params.actionText) score += 0.08;
  if (params.deadlineAt) score += 0.08;
  if (params.watchPoints.length > 0) score += 0.08;
  if (params.frameType) score += 0.04;
  if (
    params.thresholdJson.price ||
    params.thresholdJson.time_limit ||
    params.thresholdJson.unit_cost ||
    params.thresholdJson.ratio
  ) {
    score += 0.05;
  }

  return Number(Math.min(0.99, score).toFixed(2));
};

const buildSummaryAndAction = (judgmentText: string): { judgment_summary: string; action_text: string | null } => {
  const sentences = splitSentences(judgmentText)
    .map((sentence) => sentence.replace(CLEANUP_PROMPT_RE, "").trim())
    .filter(Boolean);

  const decisionIndex = sentences.findIndex((sentence) => SUMMARY_HINT_RE.test(sentence));
  const selectedIndex = decisionIndex >= 0 ? decisionIndex : Math.max(0, sentences.length - 1);
  const summarySentence = sentences[selectedIndex] ?? judgmentText;
  const actionSentence = sentences[selectedIndex + 1] ?? null;
  const summary = buildSummaryFromSentence(summarySentence).replace(CLEANUP_PROMPT_RE, "").trim();
  const action = actionSentence?.replace(CLEANUP_PROMPT_RE, "").trim() || null;

  return {
    judgment_summary: summary || trimLine(judgmentText.replace(CLEANUP_PROMPT_RE, "")),
    action_text: action || (/^(今日は|今は|現時点では)/u.test(summary) ? summary : null)
  };
};

const buildCardFromJapaneseBlock = (block: string, topicOrder: number): JudgmentCard | null => {
  const topicTitle = normalizeTopicTitle(readLineValue(block, ["導入:"]), `DeepDive ${topicOrder}`);
  const judgmentText = readLineValue(block, ["5. 今日の判断（個人視点）:"]);
  const deadlineText = readLineValue(block, ["6. 判断期限（個人の行動期限）:"]);
  const watchPoints = normalizeWatchPoints(
    readLineValue(block, ["7. 監視ポイント（個人が見るべき数値）:"])
  );

  if (!judgmentText) {
    return null;
  }

  const { judgment_summary, action_text } = buildSummaryAndAction(judgmentText);
  const frameType = readFrameType(judgmentText);
  const thresholdJson = buildThresholdJson(judgmentText, watchPoints);
  const deadlineAt = parseDeadlineAt(deadlineText);

  return {
    topic_order: topicOrder,
    topic_title: topicTitle,
    frame_type: frameType,
    judgment_type: detectJudgmentType(judgment_summary, [action_text ?? "", judgmentText].join(" ")),
    judgment_summary,
    action_text,
    deadline_at: deadlineAt,
    threshold_json: thresholdJson,
    watch_points: watchPoints,
    confidence_score: computeConfidenceScore({
      summary: judgment_summary,
      actionText: action_text,
      deadlineAt,
      watchPoints,
      frameType,
      thresholdJson
    })
  };
};

const buildCardFromEnglishBlock = (block: string, topicOrder: number): JudgmentCard | null => {
  const topicTitle = normalizeTopicTitle(readLineValue(block, ["Headline:"]), `Main Topic ${topicOrder}`);
  const judgmentText = readLineValue(block, ["Decision summary:", "Decision:"]);
  const actionText = readLineValue(block, ["Action:"]);
  const deadlineText = readLineValue(block, ["Deadline:"]);
  const watchPoints = normalizeWatchPoints(readLineValue(block, ["Watchpoints:", "Next watchpoint:"]));
  const frameType = readLineValue(block, ["Decision frame:"]) ?? readFrameType(judgmentText);

  if (!judgmentText) {
    return null;
  }

  const thresholdJson = buildThresholdJson([judgmentText, actionText ?? ""].join(" "), watchPoints);
  const deadlineAt = parseDeadlineAt(deadlineText);

  return {
    topic_order: topicOrder,
    topic_title: topicTitle,
    frame_type: frameType,
    judgment_type: detectJudgmentType(judgmentText, actionText ?? ""),
    judgment_summary: trimLine(judgmentText),
    action_text: actionText ? trimLine(actionText) : null,
    deadline_at: deadlineAt,
    threshold_json: thresholdJson,
    watch_points: watchPoints,
    confidence_score: computeConfidenceScore({
      summary: judgmentText,
      actionText,
      deadlineAt,
      watchPoints,
      frameType,
      thresholdJson
    })
  };
};

export const extractJudgmentCards = (script: string | null | undefined): JudgmentCard[] => {
  if (typeof script !== "string" || !script.trim()) {
    return [];
  }

  return splitIntoSections(script)
    .filter((section) => isJudgmentSection(section.heading))
    .map((section, index) => {
      if (/^DEEPDIVE/i.test(section.heading)) {
        return buildCardFromJapaneseBlock(section.body, index + 1);
      }

      if (/^MAIN TOPIC/i.test(section.heading)) {
        return buildCardFromEnglishBlock(section.body, index + 1);
      }

      return null;
    })
    .filter((card): card is JudgmentCard => Boolean(card))
    .slice(0, MAX_CARDS);
};
