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

const STEP = "polish-ja";
const JOB_TYPE = "polish-script-ja";
const MIN_CHARS = 3000;
const TARGET_MAX_CHARS = 6000;
const SYSTEM_PROMPT = [
  "あなたはニュース番組の放送作家です。",
  "日本語の原稿を、耳で聞いて理解しやすい放送用台本に全面リライトしてください。",
  "同一文の反復、抽象語の連発、テンプレ定型句の繰り返しを避けます。",
  "URLや記号列は読み上げない前提で自然な語に置換し、事実関係は変えません。",
  "出力は必ずJSONのみ。余計な説明文は禁止。"
].join(" ");

const toUserPrompt = (normalizedScript: string): string => {
  return [
    "次の日本語台本を放送品質へ編集してください。",
    "制約:",
    "- 事実関係は維持する（捏造禁止）",
    "- 同一表現の繰り返しを避ける",
    "- 1文は短く、目安20〜40字",
    "- セクション間の接続を自然に",
    "- [URL] は本文で読まない",
    `- 全体は概ね${MIN_CHARS}〜${TARGET_MAX_CHARS}文字を目安（短すぎ禁止）`,
    "",
    "入力台本:",
    normalizedScript
  ].join("\n");
};

const buildFallbackScript = (rawScript: string): string => {
  return normalizeScriptText(rawScript, { preserveSourceUrls: true }).text;
};

const isJaLengthAcceptable = (value: string): boolean => {
  return value.length >= MIN_CHARS;
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
          schemaName: "polished_script_ja"
        });

        const parsed = parsePolishedScriptJson(rawJson);
        parseOk = parsed.ok;

        if (!parsed.ok) {
          fallbackUsed = true;
          errorSummary = `json_parse_failed:${parsed.error}`;
        } else {
          const rendered = renderPolishedScriptText({
            lang: "ja",
            polished: parsed.data,
            originalScript: rawScript
          });
          const finalized = finalizePolishedScriptText(rendered);
          dedupedLinesCount = finalized.dedupedLinesCount;

          if (!isJaLengthAcceptable(finalized.text)) {
            fallbackUsed = true;
            errorSummary = `polished_script_too_short:${finalized.text.length}`;
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
    scriptChars: outputChars,
    chars_after: outputChars,
    chars_min: MIN_CHARS,
    chars_target_max: TARGET_MAX_CHARS,
    script_polished_preview_chars: preview.length,
    instructions_version: "ja-radio-v1"
  };

  await finishRun(runId, payload);

  return jsonResponse({
    ok: true,
    episodeId,
    ...payload
  });
});
