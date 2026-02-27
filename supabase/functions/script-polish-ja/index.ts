import { failRun, finishRun, startRun } from "../_shared/jobRuns.ts";
import { jsonResponse } from "../_shared/http.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { normalizeScriptText } from "../_shared/scriptNormalize.ts";
import { checkScriptQuality } from "../_shared/scriptQualityCheck.ts";
import {
  buildSectionsCharsBreakdown,
  parseScriptSections,
  renderScriptSections
} from "../_shared/scriptSections.ts";
import { estimateScriptDurationSec, resolveScriptGateConfig } from "../_shared/scriptGate.ts";

type RequestBody = {
  episodeDate?: string;
  idempotencyKey?: string;
  episodeId?: string;
};

type ChatMessage = {
  role: "system" | "user";
  content: string;
};

type OpenAiChatResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  error?: {
    message?: string;
  };
};

type EpisodeRow = {
  id: string;
  lang: string | null;
  script: string | null;
};

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const DEFAULT_MODEL = "gpt-4o-mini";
const TARGET_MIN_CHARS = 3500;
const TARGET_MAX_CHARS = 5000;
const ENRICH_TARGET_BUFFER = 200;
const MIN_SECTION_RETAIN_RATIO = 0.85;

const SYSTEM_PROMPT =
  "あなたはプロのポッドキャスト構成作家です。" +
  "番組コンセプトは『個人の時間とお金の最適化を支援する判断番組』です。" +
  "DeepDiveごとに判断フレーム（Frame A/B/C/D）を宣言し、数値計算または条件判定で結論を出してください。" +
  "ニュースを自然な話し言葉に再構成してください。" +
  "判断は個人の時間とお金に限定し、B2B視点は扱わないでください。" +
  "重複表現は禁止。placeholderは禁止。" +
  "放送として自然なテンポを作ってください。";

const stripCodeFence = (value: string): string => {
  const trimmed = value.trim();
  const fenced = trimmed.match(/^```[a-zA-Z0-9_-]*\n([\s\S]*?)\n```$/);
  return fenced ? fenced[1].trim() : trimmed;
};

const resolveModel = (): string => {
  const envModel = Deno.env.get("SCRIPT_POLISH_MODEL")?.trim();
  return envModel && envModel.length > 0 ? envModel : DEFAULT_MODEL;
};

const parseChatContent = (payload: OpenAiChatResponse): string => {
  const content = payload.choices?.[0]?.message?.content;
  return typeof content === "string" ? content.trim() : "";
};

const toUserPrompt = (script: string, retryDirective?: string): string => {
  const sections = parseScriptSections(script);
  const sectionHeadings = sections.map((section) => section.heading);
  const sectionHeadingList = sectionHeadings.map((heading) => `- [${heading}]`).join("\n");

  return [
    "以下の日本語台本を、放送品質の話し言葉へ再構成してください。",
    "厳守ルール:",
    "- セクション構造を維持する（同じ見出しを同じ順番で残す）",
    "- OPには必ず『この番組はあなたの時間とお金を守る』『解説ではなく意思決定支援』を含める",
    "- DEEPDIVEは1〜7の項目構成を維持し、⑤を『今日の判断（個人視点）』としてFrame A/B/C/Dを宣言し、数値計算または条件判定と結論を入れたうえで必ず『あなたはどうするか。』で終える",
    "- ⑥は『判断期限（個人の行動期限）』、⑦は『監視ポイント（個人が見るべき数値）』にする",
    "- 判断は個人の時間とお金に限定し、事業者予算配分・媒体配分・業界戦略・媒体再設計の話題は禁止",
    "- 重複表現・冗長な補足を削る",
    "- placeholder と数式トークンを削除する",
    "- URLを本文で読み上げない",
    "- テンプレ文の繰り返しを禁止する（例: 30分固定を全DEEPDIVEで繰り返さない）",
    "- DeepDiveは具体例を入れて具体化する",
    "- QuickNewsは入力本数（通常6本）を維持し、各項目に判断タグ【今使う】【今使わない】【監視】を付ける",
    "- QuickNewsでも可能な範囲でFrame A/B/C/Dを使い、判断根拠を一行入れる",
    `- 文字数はおおよそ${TARGET_MIN_CHARS}〜${TARGET_MAX_CHARS}文字`,
    "",
    "出力ルール:",
    "- 出力は台本本文のみ",
    "- 各セクション見出しは [見出し] 形式で出力",
    "- 見出し一覧:",
    sectionHeadingList || "- [OP]",
    ...(retryDirective ? ["", "追加指示:", retryDirective] : []),
    "",
    "元台本:",
    script
  ].join("\n");
};

const reconcileSectionStructure = (original: string, polished: string): string => {
  const originalSections = parseScriptSections(original);
  if (originalSections.length === 0) {
    return polished.trim();
  }

  const polishedSections = parseScriptSections(polished);
  if (polishedSections.length === 0) {
    return original;
  }

  const polishedByHeading = new Map<string, string>();
  for (const section of polishedSections) {
    if (!polishedByHeading.has(section.heading)) {
      polishedByHeading.set(section.heading, section.body.trim());
    }
  }

  const merged = originalSections.map((section) => {
    const polishedBody = polishedByHeading.get(section.heading) ?? section.body;
    const shouldKeepOriginal =
      section.body.length > 0 &&
      polishedBody.length < Math.floor(section.body.length * MIN_SECTION_RETAIN_RATIO);
    return {
      heading: section.heading,
      body: shouldKeepOriginal ? section.body : polishedBody
    };
  });

  return renderScriptSections(merged);
};

const inflateWithOriginalSections = (params: {
  original: string;
  candidate: string;
  minChars: number;
}): string => {
  const originalSections = parseScriptSections(params.original);
  const candidateSections = parseScriptSections(params.candidate);
  if (originalSections.length === 0 || candidateSections.length === 0) {
    return params.candidate;
  }

  const candidateByHeading = new Map<string, string>();
  for (const section of candidateSections) {
    if (!candidateByHeading.has(section.heading)) {
      candidateByHeading.set(section.heading, section.body);
    }
  }

  const merged = originalSections.map((section) => ({
    heading: section.heading,
    body: candidateByHeading.get(section.heading) ?? section.body
  }));

  let rendered = renderScriptSections(merged);
  if (rendered.length >= params.minChars) {
    return rendered;
  }

  const refillTargets = originalSections
    .map((originalSection, index) => {
      const currentBody = merged[index]?.body ?? "";
      const gain = originalSection.body.length - currentBody.length;
      return { index, gain };
    })
    .filter((item) => item.gain > 0)
    .sort((left, right) => right.gain - left.gain);

  for (const target of refillTargets) {
    merged[target.index] = {
      heading: originalSections[target.index].heading,
      body: originalSections[target.index].body
    };
    rendered = renderScriptSections(merged);
    if (rendered.length >= params.minChars) {
      break;
    }
  }

  return rendered;
};

const normalizeSentenceKey = (value: string): string => {
  return value
    .toLowerCase()
    .replace(/[\s\t]+/g, "")
    .replace(/[、。,.!?！？:;\-~…・"'`]/g, "")
    .trim();
};

const extractSentences = (value: string): string[] => {
  const sentenceLike = value
    .split(/(?<=[。.!?！？])\s+/u)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  if (sentenceLike.length > 0) {
    return sentenceLike;
  }
  return value
    .split(/\r?\n/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
};

const enrichWithOriginalContext = (params: {
  candidate: string;
  original: string;
  targetChars: number;
}): string => {
  if (params.candidate.length >= params.targetChars) {
    return params.candidate;
  }

  const seen = new Set(
    extractSentences(params.candidate)
      .map((sentence) => normalizeSentenceKey(sentence))
      .filter((key) => key.length > 0)
  );
  const additions: string[] = [];

  for (const sentence of extractSentences(params.original)) {
    const key = normalizeSentenceKey(sentence);
    if (!key || seen.has(key)) {
      continue;
    }
    additions.push(sentence);
    seen.add(key);
    if (`${params.candidate}\n${additions.join("\n")}`.length >= params.targetChars) {
      break;
    }
  }

  return additions.length > 0 ? `${params.candidate}\n${additions.join("\n")}`.trim() : params.candidate;
};

const requestOpenAiPolish = async (params: {
  script: string;
  model: string;
  retryDirective?: string;
}): Promise<string> => {
  const apiKey = Deno.env.get("OPENAI_API_KEY")?.trim();
  if (!apiKey) {
    throw new Error("openai_api_key_missing");
  }

  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: toUserPrompt(params.script, params.retryDirective) }
  ];

  const response = await fetch(OPENAI_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: params.model,
      temperature: 0.3,
      max_tokens: 5000,
      messages
    }),
    signal: AbortSignal.timeout(45_000)
  });

  const payload = (await response.json().catch(() => ({}))) as OpenAiChatResponse;
  if (!response.ok) {
    throw new Error(payload.error?.message?.trim() || `openai_http_${response.status}`);
  }

  const content = parseChatContent(payload);
  if (!content) {
    throw new Error("openai_empty_response");
  }

  return stripCodeFence(content);
};

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "method_not_allowed" }, 405);
  }

  const body = (await req.json().catch(() => ({}))) as RequestBody;
  const episodeDate = body.episodeDate ?? new Date().toISOString().slice(0, 10);
  const idempotencyKey = body.idempotencyKey ?? `daily-${episodeDate}`;
  const episodeId = (body.episodeId ?? "").trim();
  const model = resolveModel();
  const scriptGate = resolveScriptGateConfig();

  if (!episodeId) {
    return jsonResponse({ ok: false, error: "episodeId is required" }, 400);
  }

  const runId = await startRun("script-polish-ja", {
    step: "script-polish-ja",
    episodeDate,
    idempotencyKey,
    episodeId,
    model
  });

  try {
    const { data, error } = await supabaseAdmin
      .from("episodes")
      .select("id, lang, script")
      .eq("id", episodeId)
      .single();

    if (error || !data) {
      throw error ?? new Error(`episode_not_found:${episodeId}`);
    }

    const episode = data as EpisodeRow;
    if (episode.lang !== "ja") {
      throw new Error(`episode_is_not_japanese:${episodeId}`);
    }

    const rawScript = (episode.script ?? "").trim();
    if (!rawScript) {
      throw new Error("empty_script");
    }

    const normalizedBefore = normalizeScriptText(rawScript, { preserveSourceUrls: true });
    const evaluateCandidate = (value: string) => {
      const reconciled = reconcileSectionStructure(normalizedBefore.text, value);
      const inflated = inflateWithOriginalSections({
        original: normalizedBefore.text,
        candidate: reconciled,
        minChars: 2500
      });
      const enriched = enrichWithOriginalContext({
        candidate: inflated,
        original: normalizedBefore.text,
        targetChars: TARGET_MIN_CHARS + ENRICH_TARGET_BUFFER
      });
      const normalized = normalizeScriptText(enriched, { preserveSourceUrls: true });
      const qualityResult = checkScriptQuality(normalized.text, {
        minChars: 2500,
        maxDuplicateRatio: 0.04
      });
      return {
        normalized,
        quality: qualityResult
      };
    };

    const polishedDraft = await requestOpenAiPolish({
      script: normalizedBefore.text,
      model
    });
    let bestCandidate = evaluateCandidate(polishedDraft);

    if (bestCandidate.normalized.text.length < TARGET_MIN_CHARS) {
      const retryDraft = await requestOpenAiPolish({
        script: normalizedBefore.text,
        model,
        retryDirective:
          `前回の出力は${bestCandidate.normalized.text.length}文字で短すぎました。` +
          `情報量を落とさず、${TARGET_MIN_CHARS}〜${TARGET_MAX_CHARS}文字で再出力してください。`
      });
      const retryCandidate = evaluateCandidate(retryDraft);
      if (retryCandidate.normalized.text.length > bestCandidate.normalized.text.length) {
        bestCandidate = retryCandidate;
      }
    }

    const polishedCandidate = bestCandidate.normalized;
    const polishedQuality = bestCandidate.quality;
    const shouldFallback = !polishedQuality.ok;
    const normalizedAfter = shouldFallback ? normalizedBefore : polishedCandidate;
    const quality = shouldFallback
      ? checkScriptQuality(normalizedBefore.text, {
          minChars: 2500,
          maxDuplicateRatio: 0.04
        })
      : polishedQuality;
    const fallbackReason = shouldFallback
      ? `quality_failed:${polishedQuality.violations.join(",")}`
      : null;
    const polishApplied = !shouldFallback && normalizedAfter.text !== normalizedBefore.text;

    const scriptChars = normalizedAfter.text.length;
    const estimatedDurationSec = estimateScriptDurationSec(scriptChars, scriptGate.charsPerMin);
    const charsTargetSatisfied = scriptChars >= TARGET_MIN_CHARS && scriptChars <= TARGET_MAX_CHARS;

    const { error: updateError } = await supabaseAdmin
      .from("episodes")
      .update({
        script: normalizedAfter.text,
        duration_sec: estimatedDurationSec
      })
      .eq("id", episodeId);

    if (updateError) {
      throw updateError;
    }

    const payload = {
      step: "script-polish-ja",
      episodeDate,
      idempotencyKey,
      episodeId,
      model,
      polish_applied: polishApplied,
      fallback_reason: fallbackReason,
      candidate_chars: polishedCandidate.text.length,
      candidate_violations: polishedQuality.violations,
      scriptChars: scriptChars,
      chars_before: normalizedBefore.text.length,
      chars_after: scriptChars,
      chars_target_min: TARGET_MIN_CHARS,
      chars_target_max: TARGET_MAX_CHARS,
      chars_target_satisfied: charsTargetSatisfied,
      estimatedDurationSec,
      sections_chars_breakdown: buildSectionsCharsBreakdown(normalizedAfter.text),
      removed_html_count: normalizedAfter.metrics.removedHtmlCount,
      removed_url_count: normalizedAfter.metrics.removedUrlCount,
      removed_placeholder_count: normalizedAfter.metrics.removedPlaceholderCount,
      deduped_lines_count: normalizedAfter.metrics.dedupedLinesCount,
      quality: {
        duplicate_ratio: Number(quality.metrics.duplicateRatio.toFixed(4)),
        duplicate_line_count: quality.metrics.duplicateLineCount,
        char_length: quality.metrics.charLength,
        violations: quality.violations
      }
    };

    await finishRun(runId, payload);
    return jsonResponse({
      ok: true,
      ...payload
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await failRun(runId, message, {
      step: "script-polish-ja",
      episodeDate,
      idempotencyKey,
      episodeId,
      model
    });
    return jsonResponse({ ok: false, error: message, runId }, 500);
  }
});
