import type { SitePagePublic } from '@shared/content/site-page';
import { HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import type { ResolveFn } from '@angular/router';
import { catchError, of, throwError } from 'rxjs';

import { PublicPagesService } from '../../core/pages/public-pages.service';

/** Resolve public content before SSR; unknown or unpublished pages render the real 404 page. */
export const sitePageResolver: ResolveFn<SitePagePublic | null> = (route) => {
  const slug = route.paramMap.get('slug');
  if (!slug) return of(null);

  return inject(PublicPagesService)
    .getPublished(slug)
    .pipe(
      catchError((error: unknown) => {
        if (error instanceof HttpErrorResponse && error.status === 404) return of(null);
        // A backend outage must not masquerade as an absent page.
        return throwError(() => error);
      }),
    );
};
