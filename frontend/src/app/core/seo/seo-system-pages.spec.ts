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
  key: 'system:about', slug: 'about', kind: 'system', publishedAt: '2026-10-22T12:00:00Z',
  metadata: {
    title: { de: 'Über Mimi', en: 'About Mimi' },
    seoTitle: { de: 'Neue Seite', en: 'New page' },
    seoDescription: { de: 'Neuer Text', en: 'New copy' },
    seoImageAssetId: null, indexable: false,
  },
  document: { id: 'page', schemaVersion: 1, styles: {}, sections: [] },
};

async function initialize(data: SitePagePublic | null): Promise<void> {
  const router = {
    events: new Subject<never>(),
    url: '/about',
    routerState: { snapshot: { root: { firstChild: {
      firstChild: null,
      routeConfig: { path: 'about' },
      data: { systemSlug: 'about', data },
    } } } },
  };
  TestBed.configureTestingModule({ providers: [
    SeoService,
    { provide: Router, useValue: router },
    { provide: Store, useValue: { select: () => of('de') } },
    { provide: REQUEST, useValue: new Request('https://mimishow.de/about') },
    { provide: PUBLIC_ORIGIN, useValue: 'https://mimishow.de' },
    { provide: SeoSettingsService, useValue: { load: async () => undefined, get: () => null } },
  ] });
  await TestBed.inject(SeoService).initialize();
}

describe('system-page SEO migration', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
    document.head.querySelectorAll('link[rel="canonical"], meta[name="robots"], meta[name="description"], meta[property^="og:"], #mimishow-seo-json-ld')
      .forEach((element) => element.remove());
  });

  it('keeps legacy static SEO until the system page is published', async () => {
    await initialize(null);
    expect(document.title).toContain('Über Mimi');
    expect(document.querySelector<HTMLMetaElement>('meta[name="robots"]')?.content)
      .toContain('index, follow');
  });

  it('uses published Composer metadata for a migrated system page', async () => {
    await initialize(published);
    expect(document.title).toBe('Neue Seite');
    expect(document.querySelector<HTMLMetaElement>('meta[name="description"]')?.content).toBe('Neuer Text');
    expect(document.querySelector<HTMLMetaElement>('meta[name="robots"]')?.content).toBe('noindex, nofollow');
    expect(document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href)
      .toBe('https://mimishow.de/about');
  });
});
