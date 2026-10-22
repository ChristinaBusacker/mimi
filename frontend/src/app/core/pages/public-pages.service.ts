import type { SitePagePublic } from '@shared/content/site-page';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';

import { RequestService } from '../http/request.service';

/** Only published snapshots are exposed here. Never use the admin API on public routes. */
@Injectable({ providedIn: 'root' })
export class PublicPagesService {
  private readonly request = inject(RequestService);

  getPublished(slug: string): Observable<SitePagePublic> {
    return this.request.get<SitePagePublic>(`/pages/${encodeURIComponent(slug)}`);
  }
}
