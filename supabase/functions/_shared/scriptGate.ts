const DEFAULT_TARGET_SCRIPT_MIN_CHARS = 4200;
const DEFAULT_ESTIMATED_JA_CHARS_PER_MIN = 300;

const parsePositiveInt = (raw: string | undefined): number | null => {
  if (!raw) return null;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
};

export type ScriptGateConfig = {
  minChars: number;
  charsPerMin: number;
  targetSec: number;
  targetSecSource: "env" | "derived_from_min_chars";
  rule: string;
};

export const estimateScriptDurationSec = (scriptChars: number, charsPerMin: number): number => {
  return Math.max(60, Math.round((scriptChars / charsPerMin) * 60));
};

export const resolveScriptGateConfig = (): ScriptGateConfig => {
  const minChars =
    parsePositiveInt(Deno.env.get("TARGET_SCRIPT_MIN_CHARS")) ?? DEFAULT_TARGET_SCRIPT_MIN_CHARS;
  const charsPerMin =
    parsePositiveInt(Deno.env.get("TARGET_SCRIPT_ESTIMATED_CHARS_PER_MIN")) ??
    parsePositiveInt(Deno.env.get("ESTIMATED_JA_CHARS_PER_MIN")) ??
    DEFAULT_ESTIMATED_JA_CHARS_PER_MIN;
  const targetSecFromEnv = parsePositiveInt(Deno.env.get("TARGET_SCRIPT_DURATION_SEC"));
  const derivedTargetSec = estimateScriptDurationSec(minChars, charsPerMin);
  const targetSec = targetSecFromEnv ?? derivedTargetSec;
  const targetSecSource = targetSecFromEnv === null ? "derived_from_min_chars" : "env";
  const rule = `actualChars>=${minChars} && estimatedSec>=${targetSec} (charsPerMin=${charsPerMin}, targetSecSource=${targetSecSource})`;

  return {
    minChars,
    charsPerMin,
    targetSec,
    targetSecSource,
    rule
  };
};
