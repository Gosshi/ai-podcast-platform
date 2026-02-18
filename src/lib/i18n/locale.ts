export type Locale = "ja" | "en";

export const DEFAULT_LOCALE: Locale = "ja";

export const resolveLocale = (value: string | null | undefined): Locale => {
  return value === "en" ? "en" : DEFAULT_LOCALE;
};
