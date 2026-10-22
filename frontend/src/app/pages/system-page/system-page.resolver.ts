import type { SitePagePublic } from '@shared/content/site-page';
import { inject } from '@angular/core';
import type { ResolveFn } from '@angular/router';
import { catchError, of } from 'rxjs';

import { PublicPagesService } from '../../core/pages/public-pages.service';

/**
 * A system page has an established, working public implementation.
 * If it has not been published in the Composer (404), or if the API is temporarily
 * unavailable, keep rendering that implementation rather than losing legal content.
 */
export const systemSitePageResolver: ResolveFn<SitePagePublic | null> = (route) => {
  const slug = route.data['systemSlug'];
  if (slug !== 'about' && slug !== 'impressum' && slug !== 'datenschutz') return of(null);

  return inject(PublicPagesService).getPublished(slug).pipe(
    catchError(() => of(null)),
  );
};
