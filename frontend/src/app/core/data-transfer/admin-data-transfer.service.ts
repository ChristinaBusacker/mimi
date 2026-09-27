import type {
  DataTransferImportResult,
  DataTransferProviderInfo,
  DataTransferValidationResult,
  MimiExport,
  MimiExportBundle,
} from '@shared/data-transfer/data-transfer';

import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';

import { RequestService } from '../http/request.service';

@Injectable({
  providedIn: 'root',
})
export class AdminDataTransferService {
  private readonly request = inject(RequestService);

  getProviders():
    Observable<DataTransferProviderInfo[]> {
    return this.request.get<DataTransferProviderInfo[]>(
      '/admin/data-transfer',
      {
        deduplicateAcrossTabs: false,
        transferCache: false,
      },
    );
  }

  exportSection(
    type: string,
  ): Observable<MimiExport> {
    return this.request.get<MimiExport>(
      `/admin/data-transfer/${encodeURIComponent(type)}/export`,
      {
        deduplicateAcrossTabs: false,
        transferCache: false,
      },
    );
  }

  exportBundle():
    Observable<MimiExportBundle> {
    return this.request.get<MimiExportBundle>(
      '/admin/data-transfer/bundle',
      {
        deduplicateAcrossTabs: false,
        transferCache: false,
      },
    );
  }

  validateImport(
    type: string,
    payload: unknown,
  ): Observable<DataTransferValidationResult> {
    return this.request.post<DataTransferValidationResult, unknown>(
      `/admin/data-transfer/${encodeURIComponent(type)}/validate`,
      payload,
    );
  }

  importSection(
    type: string,
    payload: unknown,
  ): Observable<DataTransferImportResult> {
    return this.request.post<DataTransferImportResult, unknown>(
      `/admin/data-transfer/${encodeURIComponent(type)}/import`,
      payload,
    );
  }
}
