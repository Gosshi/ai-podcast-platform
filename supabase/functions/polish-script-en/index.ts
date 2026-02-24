import { finishRun, startRun } from "../_shared/jobRuns.ts";
import { jsonResponse } from "../_shared/http.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { normalizeScriptText } from "../_shared/scriptNormalize.ts";
import {
  buildPolishPreview,
  finalizePolishedScriptText,
  normalizeScriptForPolishInput,
  parsePolishedScriptJson,
  renderPolishedScriptText,
  requestPolishJsonFromOpenAi,
  resolveScriptPolishModel,
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
const MIN_CHARS = 1800;
const TARGET_MAX_CHARS = 4500;

const SYSTEM_PROMPT = [
  "You are a radio and news host script editor.",
  "Rewrite draft scripts into natural spoken English for broadcast.",
  "Remove broken fragments, placeholders, repeated boilerplate, and URL-like strings.",
  "Keep all factual content and do not hallucinate.",
  "Return JSON only. No extra prose."
].join(" ");

const toUserPrompt = (normalizedScript: string): string => {
  return [
    "Rewrite the following script for clean spoken English news delivery.",
    "Rules:",
    "- Keep facts intact and avoid speculation",
    "- Remove repeated boilerplate and broken fragments",
    "- Use short, clear sentences with smooth transitions",
    "- Replace [URL] with natural wording and do not read links",
    `- Keep total length around ${MIN_CHARS} to ${TARGET_MAX_CHARS} characters (too short is not allowed)`,
    "",
    "Input script:",
    normalizedScript
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
  return value.length >= MIN_CHARS && countSentences(value) >= 18;
};

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "method_not_allowed" }, 405);
  }

  const body = (await req.json().catch(() => ({}))) as RequestBody;
  const episodeDate = body.episodeDate ?? new Date().toISOString().slice(0, 10);
  const idempotencyKey = body.idempotencyKey ?? `daily-${episodeDate}`;
  const episodeId = (body.episodeId ?? "").trim();
  const model = resolveScriptPolishModel();
  const temperature = resolveScriptPolishTemperature();
  const timeoutMs = resolveScriptPolishTimeoutMs();

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
    timeout_ms: timeoutMs
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
      errorSummary = "empty_script";
    } else {
      const normalizedInput = normalizeScriptForPolishInput(rawScript);
      inputChars = normalizedInput.length;

      try {
        const rawJson = await requestPolishJsonFromOpenAi({
          model,
          temperature,
          timeoutMs,
          systemPrompt: SYSTEM_PROMPT,
          userPrompt: toUserPrompt(normalizedInput),
          schemaName: "polished_script_en"
        });

        const parsed = parsePolishedScriptJson(rawJson);
        parseOk = parsed.ok;

        if (!parsed.ok) {
          fallbackUsed = true;
          errorSummary = `json_parse_failed:${parsed.error}`;
        } else {
          const rendered = renderPolishedScriptText({
            lang: "en",
            polished: parsed.data,
            originalScript: rawScript
          });
          const finalized = finalizePolishedScriptText(rendered);
          dedupedLinesCount = finalized.dedupedLinesCount;
          sentenceCount = countSentences(finalized.text);

          if (!isEnLengthAcceptable(finalized.text)) {
            fallbackUsed = true;
            errorSummary = `polished_script_too_short:${finalized.text.length}:${sentenceCount}`;
          } else {
            finalScript = finalized.text;
            preview = buildPolishPreview(parsed.data.preview || finalized.text);
            fallbackUsed = false;
          }
        }
      } catch (error) {
        fallbackUsed = true;
        parseOk = false;
        errorSummary = summarizeError(error);
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
    episodeDate,
    idempotencyKey,
    episodeId,
    model,
    temperature,
    timeout_ms: timeoutMs,
    input_chars: inputChars,
    output_chars: outputChars,
    parse_ok: parseOk,
    fallback_used: fallbackUsed,
    error_summary: (errorSummary || "").slice(0, 500),
    no_op: noOp,
    deduped_lines_count: dedupedLinesCount,
    sentence_count: sentenceCount,
    scriptChars: outputChars,
    chars_after: outputChars,
    chars_min: MIN_CHARS,
    chars_target_max: TARGET_MAX_CHARS,
    script_polished_preview_chars: preview.length,
    instructions_version: "en-radio-v1"
  };

  await finishRun(runId, payload);

  return jsonResponse({
    ok: true,
    episodeId,
    ...payload
  });
});
