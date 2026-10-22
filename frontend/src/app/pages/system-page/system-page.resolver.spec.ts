import type { SitePagePublic } from '@shared/content/site-page';
import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import type { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { firstValueFrom, isObservable, of, throwError, type Observable } from 'rxjs';

import { PublicPagesService } from '../../core/pages/public-pages.service';
import { systemSitePageResolver } from './system-page.resolver';

const published: SitePagePublic = {
  key: 'system:impressum', slug: 'impressum', kind: 'system',
  metadata: {
    title: { de: 'Impressum', en: 'Legal notice' },
    seoTitle: { de: 'Impressum', en: 'Legal notice' },
    seoDescription: { de: '', en: '' }, seoImageAssetId: null, indexable: true,
  },
  document: { id: 'page', schemaVersion: 1, styles: {}, sections: [] },
  publishedAt: '2026-10-22T12:00:00Z',
};

async function resolve(slug: string): Promise<SitePagePublic | null> {
  const route = { data: { systemSlug: slug } } as unknown as ActivatedRouteSnapshot;
  const result = TestBed.runInInjectionContext(() =>
    systemSitePageResolver(route, {} as RouterStateSnapshot));
  if (!isObservable(result)) throw new Error('Expected an observable resolver');
  return firstValueFrom(result as Observable<SitePagePublic | null>);
}

describe('systemSitePageResolver', () => {
  it('renders only the published Composer snapshot after publication', async () => {
    const getPublished = vi.fn().mockReturnValue(of(published));
    TestBed.configureTestingModule({ providers: [{ provide: PublicPagesService, useValue: { getPublished } }] });
    await expect(resolve('impressum')).resolves.toEqual(published);
    expect(getPublished).toHaveBeenCalledWith('impressum');
  });

  it.each([404, 503])('retains the existing page when the API returns %i', async (status) => {
    const getPublished = vi.fn().mockReturnValue(throwError(() => new HttpErrorResponse({ status })));
    TestBed.configureTestingModule({ providers: [{ provide: PublicPagesService, useValue: { getPublished } }] });
    await expect(resolve('datenschutz')).resolves.toBeNull();
  });

  it('does not request any other slug through the system-page route', async () => {
    const getPublished = vi.fn();
    TestBed.configureTestingModule({ providers: [{ provide: PublicPagesService, useValue: { getPublished } }] });
    await expect(resolve('admin')).resolves.toBeNull();
    expect(getPublished).not.toHaveBeenCalled();
  });
});
