export const LOCALIZATION_LOCALES = ['de', 'en'] as const;

export type LocalizationLocale = (typeof LOCALIZATION_LOCALES)[number];
