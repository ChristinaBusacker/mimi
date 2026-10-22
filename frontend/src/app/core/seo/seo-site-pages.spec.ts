import type { SitePagePublic } from '@shared/content/site-page';
import { REQUEST } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { Store } from '@ngxs/store';
import { Subject, of } from 'rxjs';

import { PUBLIC_ORIGIN } from './seo.config';
import { SeoService } from './seo.service';
import { SeoSettingsService } from './seo-settings.service';

const published: SitePagePublic = {
  key: 'page:story', slug: 'story', kind: 'custom', publishedAt: '2026-10-22T12:00:00Z',
  metadata: {
    title: { de: 'Geschichte', en: 'Story' },
    seoTitle: { de: 'Meine Geschichte', en: 'My Story' },
    seoDescription: { de: 'Beschreibung', en: 'Description' },
    seoImageAssetId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', indexable: false,
  },
  document: { id: 'page', schemaVersion: 1, styles: {}, sections: [] },
};

function initialize(data: SitePagePublic | null, language: 'de' | 'en' = 'de'): Promise<void> {
  const router = {
    events: new Subject<never>(),
    url: '/story',
    routerState: { snapshot: { root: { firstChild: {
      firstChild: null,
      routeConfig: { path: ':slug' },
      data: { data },
    } } } },
  };
  TestBed.configureTestingModule({ providers: [
    SeoService,
    { provide: Router, useValue: router },
    { provide: Store, useValue: { select: () => of(language) } },
    { provide: REQUEST, useValue: new Request('https://mimishow.de/story') },
    { provide: PUBLIC_ORIGIN, useValue: 'https://mimishow.de' },
    { provide: SeoSettingsService, useValue: { load: async () => undefined, get: () => null } },
  ] });
  return TestBed.inject(SeoService).initialize();
}

describe('published site-page SEO', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
    document.head.querySelectorAll('link[rel="canonical"], meta[name="robots"], meta[name="description"], meta[property^="og:"], #mimishow-seo-json-ld')
      .forEach((element) => element.remove());
  });

  it('uses only published localized metadata, its social image and noindex flag', async () => {
    await initialize(published, 'en');
    expect(document.title).toBe('My Story');
    expect(document.querySelector<HTMLMetaElement>('meta[name="description"]')?.content).toBe('Description');
    expect(document.querySelector<HTMLMetaElement>('meta[name="robots"]')?.content).toBe('noindex, nofollow');
    expect(document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href).toBe('https://mimishow.de/story');
    expect(document.querySelector<HTMLMetaElement>('meta[property="og:image"]')?.content)
      .toBe('https://mimishow.de/api/assets/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/image/social/fallback');
  });

  it('prevents a missing or unpublished page from being indexed', async () => {
    await initialize(null);
    expect(document.title).toContain('nicht gefunden');
    expect(document.querySelector<HTMLMetaElement>('meta[name="robots"]')?.content).toBe('noindex, nofollow');
  });
});
