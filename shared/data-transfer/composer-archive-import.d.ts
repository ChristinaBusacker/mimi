/** Preview and result of a ZIP import. Publishing is never part of import. */
export type ComposerImportAction = 'create' | 'replace-draft' | 'skip-existing' | 'missing-album' | 'conflict' | 'empty';
export interface ComposerImportDocument {
  kind: 'page' | 'album-booklet';
  key: string;
  slug: string;
  action: ComposerImportAction;
  reason?: string;
}
export interface ComposerImportPreview {
  format: 'mimi-composer-archive';
  version: 1;
  exportedAt: string;
  documents: ComposerImportDocument[];
  assetCount: number;
  warnings: string[];
}
export interface ComposerImportResult {
  created: number;
  updated: number;
  skipped: number;
  assetsCreated: number;
  assetsReused: number;
  warnings: string[];
}
