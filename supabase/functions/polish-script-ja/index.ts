import { finishRun, startRun } from "../_shared/jobRuns.ts";
import { jsonResponse } from "../_shared/http.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { normalizeScriptText } from "../_shared/scriptNormalize.ts";
import {
  buildPolishPreview,
  checkDeepDiveConcreteReferences,
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
import { evaluateScriptQuality } from "../_shared/evaluateScriptQuality.ts";

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
const LANG = "ja";
const MIN_CHARS = 4500;
const TARGET_MIN_CHARS = 5000;
const TARGET_MAX_CHARS = 6500;
const MAX_COMPLETION_TOKENS = 12_000;

const SYSTEM_PROMPT = [
  "あなたはニュース番組の放送作家です。",
  "番組コンセプトは『個人の時間とお金の最適化を支援する判断番組』です。",
  "入力台本を、15〜20分の放送に耐える密度へ必ず拡張しながら全面リライトしてください。",
  "要約は禁止。分量を削らず、背景・影響・次アクションを具体化して説明します。",
  "判断は個人の時間とお金に限定し、B2B視点は扱いません。",
  "短い箇条書きではなく、ナレーションとして流れる長さで書きます。",
  "URL/プレースホルダ/壊れた断片/反復表現は除去し、読み上げやすい自然な日本語に統一します。",
  "事実関係は変えない。捏造、憶測、断定的な誇張は禁止。",
  "『予算配分』『媒体配分』『事業者視点』『業界戦略』『媒体再設計』という語と同義表現は禁止です。",
  "同一文型の3回以上連続と、同一フレーズの3回以上反復を禁止します。",
  "意味が曖昧な固有名詞は削除するか一般化して、文脈が通るように言い換えます。",
  "出力はJSONのみ。説明文や前置きは禁止。"
].join(" ");

const toUserPrompt = (params: {
  normalizedScript: string;
  target: string;
  attempt: number;
  previousChars: number;
  shortageChars: number;
  previousDraft: string;
  retryReason: string;
}): string => {
  const sourceScript = params.attempt > 1 && params.previousDraft
    ? params.previousDraft
    : params.normalizedScript;
  const sourceLabel = params.attempt > 1 && params.previousDraft
    ? "前回下書き（拡張対象）"
    : "入力台本";
  const retryNote = params.attempt > 1
    ? `再生成要件: 前回の出力は ${params.previousChars} 文字で、最低条件まであと ${params.shortageChars} 文字不足です。再生成理由は「${params.retryReason || "品質不足"}」。背景説明と具体例を増やし、必ず ${MIN_CHARS} 文字以上にしてください。`
    : "初回生成: 分量不足を避けるため、各セクションを十分に掘り下げてください。";

  return [
    "次の日本語台本を、放送品質の長尺スクリプトに書き直してください。",
    "制約:",
    "- 要約禁止。必ず拡張し、15〜20分相当の密度を確保する",
    `- 目標分量は${TARGET_MIN_CHARS}〜${TARGET_MAX_CHARS}文字、最低でも${MIN_CHARS}文字`,
    "- OP/HEADLINE/LETTERS/OUTROはそれぞれ2段落以上で展開",
    "- OPには必ず『この番組はあなたの時間とお金を守る』『解説ではなく意思決定支援』を含める",
    "- DEEPDIVE(3本)は各7項目構成にする",
    "- DEEPDIVEの項目名: 1.何が起きたか（事実のみ） 2.現在の立ち位置（確定情報／未確定情報） 3.リスク（個人視点） 4.チャンス（個人視点） 5.今日の判断（個人視点） 6.判断期限（個人の行動期限） 7.監視ポイント（個人が見るべき数値）",
    "- 各DEEPDIVEの⑤は必ず『あなたはどうするか。』で終える",
    "- QUICK NEWS(6本)は各項目を2〜3文でナレーションし、判断タグは【今使う】【今使わない】【監視】のみを使う",
    "- 各DEEPDIVEに具体例または数値を最低2つ入れる",
    "- 各DEEPDIVEで個人のチャンスと個人のリスクを最低1つずつ明示する",
    "- 各DEEPDIVEの冒頭に背景説明を最低1段落入れる",
    "- 抽象語（重要です、影響します等）の連続使用は禁止",
    "- 意味不明な固有名詞は削除または一般化する",
    "- 事業者予算配分、媒体配分、業界戦略、媒体再設計の話題は禁止",
    "- OPは conversational / warm",
    "- HEADLINEは fast-paced / concise",
    "- DEEPDIVEは analytical / structured",
    "- QUICK NEWSは energetic / lighter",
    "- LETTERSは friendly / empathetic",
    "- OUTROは forward-looking summary",
    "- 同一文構造の3回以上の繰り返しを禁止",
    "- 同一フレーズの3回以上の繰り返しを禁止",
    "- 各セクションに個人の時間とお金の判断ポイントを必ず含める",
    "- 事実関係は維持する（捏造禁止）",
    "- 既存方針の「事実/解釈/次アクション」を守る",
    "- 同一表現の繰り返しを避ける",
    "- 1文は短め、目安20〜45字",
    "- セクション間の接続を自然に",
    "- [URL] は本文で読まない",
    "- 出力はJSONのみ。余計な文章を含めない",
    `- ターゲット設定: ${params.target}`,
    retryNote,
    "",
    `${sourceLabel}:`,
    sourceScript
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
  let attemptsUsed = 0;
  let skippedReason = "";
  let retryReason = "";
  let deepDiveConcreteOk = false;
  let deepDiveConcreteCounts: [number, number, number] = [0, 0, 0];
  let scriptScore: number | null = null;
  let scoreDepth: number | null = null;
  let scoreClarity: number | null = null;
  let scoreRepetition: number | null = null;
  let scoreConcreteness: number | null = null;
  let scoreBroadcastReadiness: number | null = null;
  let scoreWarning = false;
  let scoreAttemptsUsed = 0;
  let scoreSkippedReason = "";
  let scoreErrorSummary = "";
  let scriptScoreDetail: Record<string, unknown> | null = null;

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
        let previousChars = 0;
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
                previousChars,
                shortageChars: Math.max(0, MIN_CHARS - previousChars),
                previousDraft,
                retryReason
              }),
              schemaName: "polished_script_ja",
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
              lang: "ja",
              polished: parsed.data,
              originalScript: rawScript
            });
            const finalized = finalizePolishedScriptText(rendered);
            dedupedLinesCount = finalized.dedupedLinesCount;
            previousChars = finalized.text.length;
            previousDraft = finalized.text;
            const concreteCheck = checkDeepDiveConcreteReferences("ja", parsed.data.sections.deepdive);
            deepDiveConcreteCounts = concreteCheck.counts;
            deepDiveConcreteOk = concreteCheck.ok;
            if (!concreteCheck.ok) {
              fallbackUsed = true;
              retryReason = `deepdive_concrete_refs_missing:${concreteCheck.failingIndices
                .map((index) => index + 1)
                .join(",")}`;
              errorSummary = retryReason;
              if (attempt >= maxAttempts) {
                break;
              }
              continue;
            }

            if (isJaLengthAcceptable(finalized.text)) {
              finalScript = finalized.text;
              preview = buildPolishPreview(parsed.data.preview || finalized.text);
              fallbackUsed = false;
              errorSummary = "";
              break;
            }

            fallbackUsed = true;
            retryReason = `polished_script_too_short:${finalized.text.length}`;
            errorSummary = retryReason;
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
    noOp = finalScript === fallbackScript;
    const qualityEvaluation = await evaluateScriptQuality({
      script: finalScript,
      lang: "ja"
    });
    if (qualityEvaluation.ok) {
      scriptScore = qualityEvaluation.detail.score;
      scoreDepth = qualityEvaluation.detail.depth;
      scoreClarity = qualityEvaluation.detail.clarity;
      scoreRepetition = qualityEvaluation.detail.repetition;
      scoreConcreteness = qualityEvaluation.detail.concreteness;
      scoreBroadcastReadiness = qualityEvaluation.detail.broadcast_readiness;
      scoreWarning = qualityEvaluation.detail.warning;
      scoreAttemptsUsed = qualityEvaluation.detail.attempts_used;
      scriptScoreDetail = qualityEvaluation.detail;
    } else {
      scoreAttemptsUsed = qualityEvaluation.attempts_used;
      scoreSkippedReason = qualityEvaluation.skipped_reason ?? "";
      scoreErrorSummary = qualityEvaluation.error_summary ?? "";
      scriptScoreDetail = {
        skipped_reason: scoreSkippedReason || null,
        error_summary: scoreErrorSummary || null,
        attempts_used: scoreAttemptsUsed,
        model: qualityEvaluation.model,
        timeout_ms: qualityEvaluation.timeout_ms
      };
    }

    const { error: updateError } = await supabaseAdmin
      .from("episodes")
      .update({
        script_polished: finalScript || null,
        script_polished_preview: preview || null,
        script_score: scriptScore,
        script_score_detail: scriptScoreDetail
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
          script_polished_preview: preview || null,
          script_score: scriptScore,
          script_score_detail: scriptScoreDetail
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
    retry_reason: retryReason || null,
    input_chars: inputChars,
    output_chars: outputChars,
    parse_ok: parseOk,
    fallback_used: fallbackUsed,
    error_summary: (errorSummary || "").slice(0, 500),
    no_op: noOp,
    deduped_lines_count: dedupedLinesCount,
    deepdive_concrete_ok: deepDiveConcreteOk,
    deepdive_concrete_counts: deepDiveConcreteCounts,
    score: scriptScore,
    depth: scoreDepth,
    clarity: scoreClarity,
    repetition: scoreRepetition,
    concreteness: scoreConcreteness,
    broadcast_readiness: scoreBroadcastReadiness,
    warning: scoreWarning,
    score_attempts_used: scoreAttemptsUsed,
    score_skipped_reason: scoreSkippedReason || null,
    score_error_summary: (scoreErrorSummary || "").slice(0, 500),
    script_score_detail: scriptScoreDetail,
    scriptChars: outputChars,
    chars_after: outputChars,
    chars_min: MIN_CHARS,
    chars_target_min: TARGET_MIN_CHARS,
    chars_target_max: TARGET_MAX_CHARS,
    script_polished_preview_chars: preview.length,
    instructions_version: "ja-radio-v3-fact-tone-score"
  };

  await finishRun(runId, payload);

  return jsonResponse({
    ok: true,
    episodeId,
    ...payload
  });
});
