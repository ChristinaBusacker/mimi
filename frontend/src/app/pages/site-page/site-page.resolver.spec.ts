import type { SitePagePublic } from '@shared/content/site-page';
import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { convertToParamMap, type ActivatedRouteSnapshot, type RouterStateSnapshot } from '@angular/router';
import { firstValueFrom, isObservable, of, throwError, type Observable } from 'rxjs';

import { PublicPagesService } from '../../core/pages/public-pages.service';
import { sitePageResolver } from './site-page.resolver';

const published = {
  key: 'page:test', slug: 'test', kind: 'custom',
  metadata: {
    title: { de: 'Test', en: 'Test' }, seoTitle: { de: 'Test', en: 'Test' },
    seoDescription: { de: '', en: '' }, seoImageAssetId: null, indexable: true,
  },
  document: { id: 'page', schemaVersion: 1, styles: {}, sections: [] },
  publishedAt: '2026-10-22T12:00:00Z',
} as SitePagePublic;

function route(slug: string): ActivatedRouteSnapshot {
  return { paramMap: convertToParamMap({ slug }) } as ActivatedRouteSnapshot;
}

async function resolve(slug: string): Promise<SitePagePublic | null> {
  const result = TestBed.runInInjectionContext(() => sitePageResolver(route(slug), {} as RouterStateSnapshot));
  if (!isObservable(result)) throw new Error('Expected an observable resolver');
  return firstValueFrom(result as Observable<SitePagePublic | null>);
}

describe('sitePageResolver', () => {
  it('returns only the public API snapshot for SSR', async () => {
    const getPublished = vi.fn().mockReturnValue(of(published));
    TestBed.configureTestingModule({ providers: [{ provide: PublicPagesService, useValue: { getPublished } }] });
    await expect(resolve('test')).resolves.toEqual(published);
    expect(getPublished).toHaveBeenCalledWith('test');
  });

  it('converts unpublished and unknown pages to the 404 component', async () => {
    const getPublished = vi.fn().mockReturnValue(throwError(() =>
      new HttpErrorResponse({ status: 404, statusText: 'Not Found' })));
    TestBed.configureTestingModule({ providers: [{ provide: PublicPagesService, useValue: { getPublished } }] });
    await expect(resolve('unpublished')).resolves.toBeNull();
  });

  it('preserves backend errors instead of returning a misleading 404', async () => {
    const getPublished = vi.fn().mockReturnValue(throwError(() =>
      new HttpErrorResponse({ status: 503, statusText: 'Unavailable' })));
    TestBed.configureTestingModule({ providers: [{ provide: PublicPagesService, useValue: { getPublished } }] });
    await expect(resolve('offline')).rejects.toMatchObject({ status: 503 });
  });
});
