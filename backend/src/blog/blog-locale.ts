export const BLOG_LOCALES = [
  'de',
  'en',
] as const;

export type BlogLocale =
  (typeof BLOG_LOCALES)[number];

export const DEFAULT_BLOG_LOCALE:
  BlogLocale = 'de';

export function isBlogLocale(
  value: string,
): value is BlogLocale {
  return BLOG_LOCALES.includes(
    value as BlogLocale,
  );
}
