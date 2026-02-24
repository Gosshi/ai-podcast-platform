import { finishRun, startRun } from "../_shared/jobRuns.ts";
import { jsonResponse } from "../_shared/http.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { normalizeScriptText } from "../_shared/scriptNormalize.ts";
import {
  buildPolishPreview,
  countWords,
  finalizePolishedScriptText,
  hasOpenAiApiKey,
  normalizeScriptForPolishInput,
  parsePolishedScriptJson,
  renderPolishedScriptText,
  requestPolishJsonFromOpenAi,
  resolveScriptPolishEnabled,
  resolveScriptPolishMaxAttempts,
  resolveScriptPolishModel,
  resolveScriptPolishTarget,
  resolveScriptPolishTemperature,
  resolveScriptPolishTimeoutMs,
  summarizeError
} from "../_shared/scriptPolish.ts";

type RequestBody = {
  episodeDate?: string;
  idempotencyKey?: string;
  episodeId?: string;
};

type EpisodeRow = {
  id: string;
  lang: string | null;
  script: string | null;
};

const STEP = "polish-en";
const JOB_TYPE = "polish-script-en";
const LANG = "en";
const MIN_WORDS = 1800;
const TARGET_WORDS = 2500;
const TARGET_MAX_WORDS = 3200;
const MAX_COMPLETION_TOKENS = 12_000;

const SYSTEM_PROMPT = [
  "You are a radio and news host script editor.",
  "Rewrite the script into a broadcast-ready 15-20 minute spoken script and always expand details.",
  "Summarization is forbidden. Expand context, implications, and next actions while preserving facts.",
  "The script must be long-form narration, not short notes.",
  "Remove URL-like strings, placeholders, broken fragments, and repeated boilerplate.",
  "Do not hallucinate or add unverified claims.",
  "Output must be JSON only with no extra prose."
].join(" ");

const toUserPrompt = (params: {
  normalizedScript: string;
  target: string;
  attempt: number;
  previousWords: number;
  shortageWords: number;
  previousDraft: string;
}): string => {
  const sourceScript = params.attempt > 1 && params.previousDraft
    ? params.previousDraft
    : params.normalizedScript;
  const sourceLabel = params.attempt > 1 && params.previousDraft
    ? "Previous draft to expand"
    : "Input script";
  const retryNote = params.attempt > 1
    ? `Retry requirement: previous output had ${params.previousWords} words, still short by ${params.shortageWords} words. Expand with concrete implications and practical guidance until it exceeds ${MIN_WORDS} words.`
    : "First attempt: prioritize depth and pacing to avoid a short script.";

  return [
    "Rewrite this English script into a long-form broadcast script.",
    "Rules:",
    "- No summarization. You must expand to a 15-20 minute spoken script",
    `- Target ${TARGET_WORDS}-${TARGET_MAX_WORDS} words, minimum ${MIN_WORDS} words`,
    "- OP/HEADLINE/LETTERS/CLOSING should each be 2+ paragraphs",
    "- DEEPDIVE (3 sections) must be 4+ paragraphs each: context -> current update -> impact -> next actions",
    "- QUICK NEWS (6 items) must be narrated in 3-4 sentences each, not bullet-only fragments",
    "- Add concrete examples and practical implications in every section",
    "- Keep factual content intact; no made-up details",
    "- Keep the fact/interpretation/next-action framing",
    "- Use short, clear spoken sentences with natural transitions",
    "- Do not read [URL] in the script body",
    "- Return JSON only",
    `- Target profile: ${params.target}`,
    retryNote,
    "",
    `${sourceLabel}:`,
    sourceScript
  ].join("\n");
};

const buildFallbackScript = (rawScript: string): string => {
  return normalizeScriptText(rawScript, { preserveSourceUrls: true }).text;
};

const countSentences = (value: string): number => {
  return value
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0).length;
};

const isEnLengthAcceptable = (value: string): boolean => {
  return countWords(value) >= MIN_WORDS;
};

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "method_not_allowed" }, 405);
  }

  const body = (await req.json().catch(() => ({}))) as RequestBody;
  const episodeDate = body.episodeDate ?? new Date().toISOString().slice(0, 10);
  const idempotencyKey = body.idempotencyKey ?? `daily-${episodeDate}`;
  const episodeId = (body.episodeId ?? "").trim();
  const model = resolveScriptPolishModel("gpt-4.1-mini");
  const temperature = resolveScriptPolishTemperature();
  const timeoutMs = resolveScriptPolishTimeoutMs();
  const maxAttempts = resolveScriptPolishMaxAttempts();
  const target = resolveScriptPolishTarget();
  const enabled = resolveScriptPolishEnabled();
  const hasApiKey = hasOpenAiApiKey();

  if (!episodeId) {
    return jsonResponse({ ok: false, error: "episodeId is required" }, 400);
  }

  const runId = await startRun(JOB_TYPE, {
    step: STEP,
    episodeDate,
    idempotencyKey,
    episodeId,
    model,
    temperature,
    timeout_ms: timeoutMs,
    max_attempts: maxAttempts,
    target,
    enabled
  });

  let rawScript = "";
  let fallbackScript = "";
  let inputChars = 0;
  let outputChars = 0;
  let parseOk = false;
  let fallbackUsed = true;
  let errorSummary = "";
  let noOp = true;
  let finalScript = "";
  let preview = "";
  let dedupedLinesCount = 0;
  let sentenceCount = 0;
  let wordCount = 0;
  let attemptsUsed = 0;
  let skippedReason = "";

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
    if (episode.lang !== "en") {
      throw new Error(`episode_is_not_english:${episodeId}`);
    }

    rawScript = (episode.script ?? "").trim();
    fallbackScript = buildFallbackScript(rawScript);
    finalScript = fallbackScript;
    preview = buildPolishPreview(fallbackScript);

    if (!rawScript) {
      fallbackUsed = true;
      skippedReason = "empty_script";
      errorSummary = "empty_script";
    } else {
      const normalizedInput = normalizeScriptForPolishInput(rawScript);
      inputChars = normalizedInput.length;

      if (!normalizedInput) {
        fallbackUsed = true;
        skippedReason = "empty_after_normalize";
        errorSummary = "empty_after_normalize";
      } else if (!enabled) {
        fallbackUsed = true;
        skippedReason = "disabled_by_env";
      } else if (!hasApiKey) {
        fallbackUsed = true;
        skippedReason = "openai_api_key_missing";
        errorSummary = "openai_api_key_missing";
      } else {
        let previousWords = 0;
        let previousDraft = "";

        for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
          attemptsUsed = attempt;
          try {
            const rawJson = await requestPolishJsonFromOpenAi({
              model,
              temperature,
              timeoutMs,
              systemPrompt: SYSTEM_PROMPT,
              userPrompt: toUserPrompt({
                normalizedScript: normalizedInput,
                target,
                attempt,
                previousWords,
                shortageWords: Math.max(0, MIN_WORDS - previousWords),
                previousDraft
              }),
              schemaName: "polished_script_en",
              maxCompletionTokens: MAX_COMPLETION_TOKENS
            });

            const parsed = parsePolishedScriptJson(rawJson);
            if (!parsed.ok) {
              parseOk = false;
              fallbackUsed = true;
              errorSummary = `json_parse_failed:${parsed.error}`;
              break;
            }

            parseOk = true;
            const rendered = renderPolishedScriptText({
              lang: "en",
              polished: parsed.data,
              originalScript: rawScript
            });
            const finalized = finalizePolishedScriptText(rendered);
            dedupedLinesCount = finalized.dedupedLinesCount;
            previousWords = countWords(finalized.text);
            previousDraft = finalized.text;
            sentenceCount = countSentences(finalized.text);

            if (isEnLengthAcceptable(finalized.text)) {
              finalScript = finalized.text;
              preview = buildPolishPreview(parsed.data.preview || finalized.text);
              fallbackUsed = false;
              errorSummary = "";
              break;
            }

            fallbackUsed = true;
            errorSummary = `polished_script_too_short:${finalized.text.length}:${previousWords}`;
            if (attempt >= maxAttempts) {
              break;
            }
          } catch (error) {
            parseOk = false;
            fallbackUsed = true;
            errorSummary = summarizeError(error);
            break;
          }
        }
      }
    }

    if (!finalScript) {
      finalScript = fallbackScript;
    }

    if (!preview) {
      preview = buildPolishPreview(finalScript);
    }

    outputChars = finalScript.length;
    sentenceCount = sentenceCount || countSentences(finalScript);
    wordCount = countWords(finalScript);
    noOp = finalScript === fallbackScript;

    const { error: updateError } = await supabaseAdmin
      .from("episodes")
      .update({
        script_polished: finalScript || null,
        script_polished_preview: preview || null
      })
      .eq("id", episodeId);

    if (updateError) {
      throw updateError;
    }
  } catch (error) {
    fallbackUsed = true;
    parseOk = false;
    errorSummary = errorSummary || summarizeError(error);
    if (!fallbackScript) {
      fallbackScript = buildFallbackScript(rawScript);
    }
    finalScript = finalScript || fallbackScript;
    preview = preview || buildPolishPreview(finalScript);
    outputChars = finalScript.length;
    sentenceCount = sentenceCount || countSentences(finalScript);
    wordCount = countWords(finalScript);
    noOp = true;

    if (episodeId && finalScript) {
      await supabaseAdmin
        .from("episodes")
        .update({
          script_polished: finalScript || null,
          script_polished_preview: preview || null
        })
        .eq("id", episodeId);
    }
  }

  const payload = {
    step: STEP,
    lang: LANG,
    episodeDate,
    idempotencyKey,
    episodeId,
    model,
    temperature,
    timeout_ms: timeoutMs,
    target,
    attempt: attemptsUsed,
    max_attempts: maxAttempts,
    before_chars: inputChars,
    after_chars: outputChars,
    skipped_reason: skippedReason || null,
    input_chars: inputChars,
    output_chars: outputChars,
    parse_ok: parseOk,
    fallback_used: fallbackUsed,
    error_summary: (errorSummary || "").slice(0, 500),
    no_op: noOp,
    deduped_lines_count: dedupedLinesCount,
    sentence_count: sentenceCount,
    word_count: wordCount,
    words_after: wordCount,
    words_min: MIN_WORDS,
    words_target: TARGET_WORDS,
    words_target_max: TARGET_MAX_WORDS,
    scriptChars: outputChars,
    chars_after: outputChars,
    script_polished_preview_chars: preview.length,
    instructions_version: "en-radio-v2-expand"
  };

  await finishRun(runId, payload);

  return jsonResponse({
    ok: true,
    episodeId,
    ...payload
  });
});
