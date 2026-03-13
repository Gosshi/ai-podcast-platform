type AnalyticsScalar = string | number | boolean | null;
export type AnalyticsJsonValue = AnalyticsScalar | AnalyticsJsonValue[] | { [key: string]: AnalyticsJsonValue };
export type AnalyticsProperties = Record<string, AnalyticsJsonValue>;

const MAX_DEPTH = 4;
const MAX_ARRAY_LENGTH = 25;
const MAX_STRING_LENGTH = 500;

const sanitizeString = (value: string): string => {
  const trimmed = value.trim();
  if (trimmed.length <= MAX_STRING_LENGTH) {
    return trimmed;
  }

  return trimmed.slice(0, MAX_STRING_LENGTH);
};

const sanitizeAnalyticsValue = (value: unknown, depth = 0): AnalyticsJsonValue | undefined => {
  if (value === null) return null;
  if (value === undefined) return undefined;
  if (depth > MAX_DEPTH) return undefined;

  if (typeof value === "string") {
    return sanitizeString(value);
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }

  if (typeof value === "boolean") {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    const sanitized = value
      .slice(0, MAX_ARRAY_LENGTH)
      .map((entry) => sanitizeAnalyticsValue(entry, depth + 1))
      .filter((entry): entry is AnalyticsJsonValue => entry !== undefined);

    return sanitized;
  }

  if (typeof value === "object") {
    const result: Record<string, AnalyticsJsonValue> = {};

    for (const [key, entry] of Object.entries(value)) {
      const sanitized = sanitizeAnalyticsValue(entry, depth + 1);
      if (sanitized === undefined) continue;
      result[key] = sanitized;
    }

    return result;
  }

  return undefined;
};

export const sanitizeAnalyticsProperties = (
  properties: Record<string, unknown> | null | undefined
): AnalyticsProperties => {
  const sanitized = sanitizeAnalyticsValue(properties ?? {}, 0);
  if (!sanitized || Array.isArray(sanitized) || typeof sanitized !== "object") {
    return {};
  }

  return sanitized;
};
