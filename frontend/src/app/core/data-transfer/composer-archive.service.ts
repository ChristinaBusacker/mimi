import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import type { ComposerImportPreview, ComposerImportResult } from '@shared/data-transfer/composer-archive-import';

import { API_BASE_URL } from '../http/api-base-url.token';

export type ComposerArchiveScope = 'all' | 'pages' | 'booklets';
export interface ComposerSingleTarget { kind: 'page' | 'album-booklet'; id: string; }

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

  preview(file: File, overwrite: boolean): Observable<ComposerImportPreview> {
    return this.http.post<ComposerImportPreview>(this.importUrl('preview', overwrite), this.fileBody(file));
  }

  import(file: File, overwrite: boolean): Observable<ComposerImportResult> {
    return this.http.post<ComposerImportResult>(this.importUrl('import', overwrite), this.fileBody(file));
  }

  previewSingle(file: File, target: ComposerSingleTarget): Observable<ComposerImportPreview> {
    return this.http.post<ComposerImportPreview>(this.singleUrl('preview', target), this.fileBody(file));
  }

  importSingle(file: File, target: ComposerSingleTarget): Observable<ComposerImportResult> {
    return this.http.post<ComposerImportResult>(this.singleUrl('import', target), this.fileBody(file));
  }

  validateLayout(document: unknown, profile: 'standard' | 'album'): Observable<import('@shared/content/page-document').PageDocument> {
    return this.http.post<import('@shared/content/page-document').PageDocument>(
      `${this.apiBaseUrl}/admin/composer-archive/validate-layout?profile=${profile}`, document,
    );
  }

  private singleUrl(action: 'preview' | 'import', target: ComposerSingleTarget): string {
    return `${this.importUrl(action, true)}&targetKind=${target.kind}&targetId=${encodeURIComponent(target.id)}`;
  }

  private fileBody(file: File): FormData {
    const body = new FormData();
    body.append('file', file, file.name);
    return body;
  }

  private importUrl(action: 'preview' | 'import', overwrite: boolean): string {
    return `${this.apiBaseUrl}/admin/composer-archive/${action}?overwrite=${overwrite ? '1' : '0'}`;
  }
}
