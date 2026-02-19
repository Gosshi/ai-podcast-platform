const DEFAULT_SCRIPT_MIN_CHARS_JA = 2500;
const DEFAULT_SCRIPT_TARGET_CHARS_JA = 3200;
const DEFAULT_SCRIPT_MAX_CHARS_JA = 5200;
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
  targetChars: number;
  maxChars: number;
  charsPerMin: number;
  targetSec: number;
  targetSecSource: "env" | "derived_from_target_chars";
  rule: string;
};

export const estimateScriptDurationSec = (scriptChars: number, charsPerMin: number): number => {
  return Math.max(60, Math.round((scriptChars / charsPerMin) * 60));
};

export const resolveScriptGateConfig = (): ScriptGateConfig => {
  const minChars =
    parsePositiveInt(Deno.env.get("SCRIPT_MIN_CHARS_JA")) ??
    parsePositiveInt(Deno.env.get("TARGET_SCRIPT_MIN_CHARS")) ??
    DEFAULT_SCRIPT_MIN_CHARS_JA;
  const targetChars =
    parsePositiveInt(Deno.env.get("SCRIPT_TARGET_CHARS_JA")) ?? DEFAULT_SCRIPT_TARGET_CHARS_JA;
  const maxChars =
    parsePositiveInt(Deno.env.get("SCRIPT_MAX_CHARS_JA")) ?? DEFAULT_SCRIPT_MAX_CHARS_JA;

  const normalizedTargetChars = Math.max(minChars, targetChars);
  const normalizedMaxChars = Math.max(normalizedTargetChars, maxChars);
  const charsPerMin =
    parsePositiveInt(Deno.env.get("TARGET_SCRIPT_ESTIMATED_CHARS_PER_MIN")) ??
    parsePositiveInt(Deno.env.get("ESTIMATED_JA_CHARS_PER_MIN")) ??
    DEFAULT_ESTIMATED_JA_CHARS_PER_MIN;
  const targetSecFromEnv = parsePositiveInt(Deno.env.get("TARGET_SCRIPT_DURATION_SEC"));
  const derivedTargetSec = estimateScriptDurationSec(normalizedTargetChars, charsPerMin);
  const targetSec = targetSecFromEnv ?? derivedTargetSec;
  const targetSecSource = targetSecFromEnv === null ? "derived_from_target_chars" : "env";
  const rule =
    `${minChars}<=actualChars<=${normalizedMaxChars} && estimatedSec>=${targetSec} ` +
    `(charsPerMin=${charsPerMin}, targetSecSource=${targetSecSource})`;

  return {
    minChars,
    targetChars: normalizedTargetChars,
    maxChars: normalizedMaxChars,
    charsPerMin,
    targetSec,
    targetSecSource,
    rule
  };
};
