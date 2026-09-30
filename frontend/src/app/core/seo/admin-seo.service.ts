import type {
  SaveSeoPageOverrides,
  SeoPageOverride,
} from '@shared/seo/seo';

import {
  Injectable,
  inject,
} from '@angular/core';
import { Observable } from 'rxjs';

import { RequestService } from '../http/request.service';

@Injectable({
  providedIn: 'root',
})
export class AdminSeoService {
  private readonly request =
    inject(RequestService);

  getPages(): Observable<SeoPageOverride[]> {
    return this.request.get<SeoPageOverride[]>(
      '/admin/seo/pages',
      {
        deduplicateAcrossTabs: false,
        transferCache: false,
      },
    );
  }

  savePages(
    input: SaveSeoPageOverrides,
  ): Observable<SeoPageOverride[]> {
    return this.request.put<
      SeoPageOverride[],
      SaveSeoPageOverrides
    >(
      '/admin/seo/pages',
      input,
    );
  }
}
