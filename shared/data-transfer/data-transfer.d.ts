export interface MimiExport<TData = unknown> {
  format: 'mimi-export';
  version: 1;
  type: string;
  schemaVersion: number;
  exportedAt: string;
  data: TData;
}

export interface DataTransferProviderInfo {
  type: string;
  schemaVersion: number;
}

export interface DataTransferChangeSummary {
  created: number;
  updated: number;
  unchanged: number;
  deleted: number;
}

export interface DataTransferPreview {
  summary: DataTransferChangeSummary;
  warnings: string[];
}

export interface DataTransferValidationResult {
  provider: DataTransferProviderInfo;
  preview: DataTransferPreview;
}

export interface DataTransferImportResult {
  provider: DataTransferProviderInfo;
  summary: DataTransferChangeSummary;
  warnings: string[];
  importedAt: string;
}
