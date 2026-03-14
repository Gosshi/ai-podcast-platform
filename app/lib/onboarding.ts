export const resolveSafeNextPath = (value: string | null | undefined, fallback = "/decisions"): string => {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return fallback;
  }

  return value;
};

export const buildOnboardingPath = (nextPath: string): string => {
  const safeNextPath = resolveSafeNextPath(nextPath);
  return `/onboarding?next=${encodeURIComponent(safeNextPath)}`;
};

export const buildLoginPath = (nextPath: string): string => {
  const safeNextPath = resolveSafeNextPath(nextPath);
  return `/login?next=${encodeURIComponent(safeNextPath)}`;
};
