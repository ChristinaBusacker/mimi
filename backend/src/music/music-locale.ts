export const MUSIC_LOCALES = ['de', 'en'] as const;

export type MusicLocale = (typeof MUSIC_LOCALES)[number];

export const DEFAULT_MUSIC_LOCALE: MusicLocale = 'de';

export function isMusicLocale(value: string): value is MusicLocale {
  return MUSIC_LOCALES.some((locale) => locale === value);
}
