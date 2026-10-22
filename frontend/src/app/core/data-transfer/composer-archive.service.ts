import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';

import { API_BASE_URL } from '../http/api-base-url.token';

export type ComposerArchiveScope = 'all' | 'pages' | 'booklets';

/** Binary downloads are deliberately separate from the JSON settings-transfer API. */
@Injectable({ providedIn: 'root' })
export class ComposerArchiveClient {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = inject(API_BASE_URL).replace(/\/+$/, '');

  export(scope: ComposerArchiveScope, id?: string): Observable<Blob> {
    const query = new URLSearchParams({ scope });
    if (id) query.set('id', id);
    return this.http.get(`${this.apiBaseUrl}/admin/composer-archive/export?${query}`, {
      responseType: 'blob', transferCache: false,
    });
  }
}
