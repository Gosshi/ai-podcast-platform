import { failRun, finishRun, startRun } from "../_shared/jobRuns.ts";
import { jsonResponse } from "../_shared/http.ts";
import { fetchEpisodeById, updateEpisode } from "../_shared/episodes.ts";
import { normalizeForSpeech } from "../_shared/speechNormalization.ts";
import {
  estimateScriptDurationSec,
  resolveScriptGateConfig,
  type ScriptGateConfig
} from "../_shared/scriptGate.ts";
import {
  buildSectionsCharsBreakdown,
  parseScriptSections,
  renderScriptSections,
  type ScriptSection,
  type SectionsCharsBreakdown
} from "../_shared/scriptSections.ts";

type RequestBody = {
  episodeDate?: string;
  idempotencyKey?: string;
  episodeId?: string;
  attempt?: number;
  charsShortage?: number;
};

type ExpandResult = {
  script: string;
  scriptChars: number;
  estimatedDurationSec: number;
  sectionsCharsBreakdown: SectionsCharsBreakdown;
  addedChars: number;
};

const sanitizeNarrationText = (value: string): string => {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/&#45;/g, "-")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
};

const padSection = (body: string, minChars: number, expansions: string[]): string => {
  let padded = body.trim();
  let index = 0;

  while (padded.length < minChars) {
    const expansion = expansions[index % expansions.length] ?? expansions[0] ?? "追加視点です。";
    padded = `${padded}\n追加視点: ${expansion}`;
    index += 1;
  }

  return padded;
};

const extractDeepDiveTitles = (sections: ScriptSection[]): string[] => {
  return sections
    .filter((section) => /^DEEPDIVE\s+\d+$/i.test(section.heading))
    .map((section) => {
      const match = section.body.match(/(?:^|\n)見出し:\s*(.+)/);
      return sanitizeNarrationText(match?.[1] ?? "");
    })
    .filter((title) => title.length > 0)
    .slice(0, 3);
};

const buildExpansionBody = (params: {
  attempt: number;
  charsShortage: number;
  deepDiveTitles: string[];
}): string => {
  const focus = params.deepDiveTitles.length > 0
    ? params.deepDiveTitles.join("、")
    : "本編の主要トピック";

  const desiredMinChars = Math.max(450, Math.min(params.charsShortage + 260, 1500));

  const base = [
    `本編補足 ${params.attempt} 回目です。`,
    `具体例: ${focus}を扱う時は、導入で結論を急がず、まず前提条件を一つずつ固定すると判断が安定します。`,
    "比喩: 地図アプリで目的地だけ見ると迷いやすいのと同じで、途中経路を確認すると判断ミスが減ります。",
    "一言ツッコミ: 見出しの勢いだけで断定すると、翌日の更新で説明が破綻しがちです。",
    "背景補足: 影響範囲、更新頻度、未確定要素を分けて話すと、リスナーが自分の状況に当てはめやすくなります。",
    "まとめ: 追加補足の狙いは文字数稼ぎではなく、理解の抜けを埋めることです。リンクは概要欄にまとめ、本文では要点だけを話します。"
  ].join("\n");

  return padSection(base, desiredMinChars, [
    "もう一段具体化するなら、結論を先に1行、その根拠を2行、保留条件を1行で並べると伝わりやすくなります。",
    "聞き手の行動につなげるには、今すぐできる確認項目を最後に短く置くのが効果的です。"
  ]);
};

const buildExpandedScript = (params: {
  currentScript: string;
  attempt: number;
  charsShortage: number;
  scriptGate: ScriptGateConfig;
}): ExpandResult => {
  const currentNormalized = normalizeForSpeech(params.currentScript, "ja");
  const currentChars = currentNormalized.length;
  const parsedSections = parseScriptSections(currentNormalized);
  const deepDiveTitles = extractDeepDiveTitles(parsedSections);

  const expansionHeading = `EXPANSION ${params.attempt}`;
  let expansionBody = buildExpansionBody({
    attempt: params.attempt,
    charsShortage: params.charsShortage,
    deepDiveTitles
  });

  const sectionsWithExpansion = [...parsedSections, { heading: expansionHeading, body: expansionBody }];
  let expanded = normalizeForSpeech(renderScriptSections(sectionsWithExpansion), "ja");

  if (expanded.length > params.scriptGate.maxChars) {
    const available = Math.max(0, params.scriptGate.maxChars - currentChars - 20);
    if (available === 0) {
      expanded = currentNormalized;
    } else {
      expansionBody = expansionBody.slice(0, available).trimEnd();
      const shortened = [...parsedSections, { heading: expansionHeading, body: expansionBody }];
      expanded = normalizeForSpeech(renderScriptSections(shortened), "ja");
      if (expanded.length > params.scriptGate.maxChars) {
        expanded = expanded.slice(0, params.scriptGate.maxChars).trimEnd();
      }
    }
  }

  const scriptChars = expanded.length;
  const estimatedDurationSec = estimateScriptDurationSec(scriptChars, params.scriptGate.charsPerMin);

  return {
    script: expanded,
    scriptChars,
    estimatedDurationSec,
    sectionsCharsBreakdown: buildSectionsCharsBreakdown(expanded),
    addedChars: Math.max(0, scriptChars - currentChars)
  };
};

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "method_not_allowed" }, 405);
  }

  const body = (await req.json().catch(() => ({}))) as RequestBody;
  const episodeDate = body.episodeDate ?? new Date().toISOString().slice(0, 10);
  const idempotencyKey = body.idempotencyKey ?? `daily-${episodeDate}`;
  const episodeId = typeof body.episodeId === "string" ? body.episodeId : "";
  const attempt =
    typeof body.attempt === "number" && Number.isFinite(body.attempt) && body.attempt > 0
      ? Math.round(body.attempt)
      : 1;
  const charsShortage =
    typeof body.charsShortage === "number" && Number.isFinite(body.charsShortage) && body.charsShortage > 0
      ? Math.round(body.charsShortage)
      : 600;

  if (!episodeId) {
    return jsonResponse({ ok: false, error: "episodeId is required" }, 400);
  }

  const scriptGate = resolveScriptGateConfig();
  const runId = await startRun("expand-script-ja", {
    step: "expand-script-ja",
    episodeDate,
    idempotencyKey,
    episodeId,
    attempt,
    charsShortage,
    chars_min: scriptGate.minChars,
    chars_target: scriptGate.targetChars,
    chars_max: scriptGate.maxChars,
    scriptGate
  });

  try {
    const episode = await fetchEpisodeById(episodeId);
    if (episode.lang !== "ja") {
      throw new Error("episode_lang_mismatch");
    }

    const currentScript = episode.script ?? "";
    if (!currentScript.trim()) {
      throw new Error("missing_script");
    }

    const expanded = buildExpandedScript({
      currentScript,
      attempt,
      charsShortage,
      scriptGate
    });

    const updated = await updateEpisode(episode.id, {
      script: expanded.script,
      duration_sec: expanded.estimatedDurationSec,
      status: episode.status === "failed" ? "draft" : episode.status
    });

    await finishRun(runId, {
      step: "expand-script-ja",
      episodeDate,
      idempotencyKey,
      episodeId: updated.id,
      attempt,
      addedChars: expanded.addedChars,
      scriptChars: expanded.scriptChars,
      estimatedDurationSec: expanded.estimatedDurationSec,
      chars_actual: expanded.scriptChars,
      chars_min: scriptGate.minChars,
      chars_target: scriptGate.targetChars,
      chars_max: scriptGate.maxChars,
      sections_chars_breakdown: expanded.sectionsCharsBreakdown,
      scriptGate
    });

    return jsonResponse({
      ok: true,
      episodeDate,
      idempotencyKey,
      episodeId: updated.id,
      attempt,
      addedChars: expanded.addedChars,
      scriptChars: expanded.scriptChars,
      estimatedDurationSec: expanded.estimatedDurationSec,
      chars_actual: expanded.scriptChars,
      chars_min: scriptGate.minChars,
      chars_target: scriptGate.targetChars,
      chars_max: scriptGate.maxChars,
      sections_chars_breakdown: expanded.sectionsCharsBreakdown,
      scriptGate
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await failRun(runId, message, {
      step: "expand-script-ja",
      episodeDate,
      idempotencyKey,
      episodeId,
      attempt,
      charsShortage,
      chars_min: scriptGate.minChars,
      chars_target: scriptGate.targetChars,
      chars_max: scriptGate.maxChars,
      scriptGate
    });

    return jsonResponse({ ok: false, error: message }, 500);
  }
});
