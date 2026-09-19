export const SUPPORTED_LANGUAGES = ['de', 'en'] as const;

export type Language = (typeof SUPPORTED_LANGUAGES)[number];

export type LocalizationDictionary = Record<string, string>;

export interface I18nStateModel {
  language: Language;
  dictionaries: Partial<Record<Language, LocalizationDictionary>>;
}

export const DEFAULT_LANGUAGE: Language = 'de';

export function isLanguage(value: unknown): value is Language {
  return SUPPORTED_LANGUAGES.some((language) => language === value);
}
