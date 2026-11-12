export const locales = ["uz", "en"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "uz";
export const LOCALE_COOKIE = "NEXT_LOCALE";

export function toLocale(value: string | undefined | null): Locale {
  return value === "en" ? "en" : defaultLocale;
}
