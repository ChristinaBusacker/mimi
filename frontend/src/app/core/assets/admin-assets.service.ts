import type {
  Asset,
  AssetType,
} from '@shared/assets/asset';

import {
  Injectable,
  inject,
} from '@angular/core';
import { Observable } from 'rxjs';

import { RequestService } from '../http/request.service';

@Injectable({
  providedIn: 'root',
})
export class AdminAssetsService {
  private readonly request = inject(RequestService);

  getAll(type: AssetType): Observable<Asset[]> {
    return this.request.get<Asset[]>(
      `/admin/assets?type=${type}`,
      {
        deduplicateAcrossTabs: false,
        transferCache: false,
      },
    );
  }

  upload(file: File): Observable<Asset> {
    const body = new FormData();

    body.append('file', file);

    return this.request.post<Asset, FormData>(
      '/admin/assets',
      body,
    );
  }

  delete(id: string): Observable<void> {
    return this.request.delete<void>(
      `/admin/assets/${id}`,
    );
  }
}
