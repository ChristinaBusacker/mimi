import type { DataTransferPreview } from '@shared/data-transfer/data-transfer';

export interface DataTransferImportContext {
  userUuid: string;
}

export interface DataTransferProvider<TData = unknown> {
  readonly type: string;
  readonly schemaVersion: number;

  exportData(): Promise<TData>;

  validateImport(data: unknown): Promise<DataTransferPreview>;

  importData(data: unknown, context: DataTransferImportContext): Promise<DataTransferPreview>;
}
