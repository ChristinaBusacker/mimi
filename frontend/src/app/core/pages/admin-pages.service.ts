import type { PageDocument } from '@shared/content/page-document';
import type {
  CreateSitePageInput, SitePageAdmin, SitePageMetadata, SitePageSummary,
} from '@shared/content/site-page';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { RequestService } from '../http/request.service';

/** Admin-only API. Never cache drafts in the Angular SSR transfer state. */
@Injectable({ providedIn: 'root' })
export class AdminPagesService {
  private readonly request = inject(RequestService);
  private readonly options = { deduplicateAcrossTabs: false, transferCache: false } as const;

  list(): Observable<SitePageSummary[]> {
    return this.request.get<SitePageSummary[]>('/admin/pages', this.options);
  }

  get(id: string): Observable<SitePageAdmin> {
    return this.request.get<SitePageAdmin>(`/admin/pages/${encodeURIComponent(id)}`, this.options);
  }

  create(input: CreateSitePageInput): Observable<SitePageAdmin> {
    return this.request.post<SitePageAdmin, CreateSitePageInput>('/admin/pages', input);
  }

  updateMetadata(id: string, metadata: SitePageMetadata): Observable<SitePageAdmin> {
    return this.request.patch<SitePageAdmin, { metadata: SitePageMetadata }>(
      `/admin/pages/${encodeURIComponent(id)}/metadata`, { metadata },
    );
  }

  saveDraft(id: string, document: PageDocument): Observable<SitePageAdmin> {
    return this.request.patch<SitePageAdmin, { document: PageDocument }>(
      `/admin/pages/${encodeURIComponent(id)}/draft`, { document },
    );
  }

  publish(id: string): Observable<SitePageAdmin> {
    return this.request.post<SitePageAdmin, Record<string, never>>(
      `/admin/pages/${encodeURIComponent(id)}/publish`, {},
    );
  }

  delete(id: string): Observable<void> {
    return this.request.delete<void>(`/admin/pages/${encodeURIComponent(id)}`);
  }
}
