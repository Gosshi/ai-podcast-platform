export const FREE_ACCESS_WINDOW_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

export const isWithinFreeAccessWindow = (
  value: string | null,
  now = new Date()
): boolean => {
  if (!value) return false;

  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return false;

  return now.getTime() - timestamp <= FREE_ACCESS_WINDOW_DAYS * DAY_MS;
};
