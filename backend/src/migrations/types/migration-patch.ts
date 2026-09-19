export interface LocalizationPatchEntry {
  key: string;
  de: string;
  en: string;
}

export interface MigrationPatch {
  localizations?: LocalizationPatchEntry[];
}
