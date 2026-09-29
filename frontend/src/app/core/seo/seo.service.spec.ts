import { REQUEST } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { Store } from '@ngxs/store';
import { Subject, of } from 'rxjs';

import { PUBLIC_ORIGIN } from './seo.config';
import { SeoService } from './seo.service';

class RouterStub {
  readonly events = new Subject<never>();
  readonly url = '/blog/test-post';
  readonly routerState = {
    snapshot: {
      root: {
        firstChild: {
          firstChild: null,
          routeConfig: {
            path: 'blog/:slug',
          },
          data: {
            data: {
              locale: 'de',
              post: {
                id: 'post-id',
                slug: 'test-post',
                title: 'Testbeitrag',
                excerpt: 'Ein Testbeitrag für die SEO-Metadaten.',
                coverAssetId: 'cover-id',
                publishedAt: '2026-09-20T10:00:00.000Z',
                updatedAt: '2026-09-28T12:00:00.000Z',
                author: {
                  slug: 'mimi',
                  displayName: 'Mimi',
                  avatarAssetId: null,
                  bioHtml: '',
                },
                categories: [
                  {
                    slug: 'news',
                    name: 'News',
                  },
                ],
                contentHtml: '<p>Testinhalt</p>',
              },
            },
          },
        },
      },
    },
  };
}

class StoreStub {
  select() {
    return of('de' as const);
  }
}

describe('SeoService', () => {
  afterEach(() => {
    document.head
      .querySelectorAll(
        [
          'link[rel="canonical"]',
          '#mimishow-seo-json-ld',
          'meta[property^="og:"]',
          'meta[property^="article:"]',
          'meta[property^="music:"]',
          'meta[name^="twitter:"]',
        ].join(','),
      )
      .forEach((element) => element.remove());
    document.querySelector('meta[name="robots"]')?.remove();
    document.querySelector('meta[name="description"]')?.remove();
    TestBed.resetTestingModule();
  });

  it('uses the configured public origin, large social image and modification date', () => {
    TestBed.configureTestingModule({
      providers: [
        SeoService,
        {
          provide: Router,
          useClass: RouterStub,
        },
        {
          provide: Store,
          useClass: StoreStub,
        },
        {
          provide: REQUEST,
          useValue: new Request('https://www.mimishow.de/blog/test-post'),
        },
        {
          provide: PUBLIC_ORIGIN,
          useValue: 'https://mimishow.de',
        },
      ],
    });

    TestBed.inject(SeoService).initialize();

    expect(
      document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href,
    ).toBe('https://mimishow.de/blog/test-post');
    expect(
      document.head.querySelector<HTMLMetaElement>('meta[property="og:image"]')?.content,
    ).toBe(
      'https://mimishow.de/api/assets/cover-id/image/large/fallback',
    );
    expect(
      document.head.querySelector<HTMLMetaElement>(
        'meta[property="article:modified_time"]',
      )?.content,
    ).toBe('2026-09-28T12:00:00.000Z');
    expect(
      document.head.querySelector<HTMLMetaElement>('meta[name="robots"]')?.content,
    ).toContain('index, follow');

    const jsonLd = document.getElementById('mimishow-seo-json-ld');
    const graph = JSON.parse(jsonLd?.textContent ?? '{}') as {
      '@graph'?: Array<Record<string, unknown>>;
    };
    const article = graph['@graph']?.find(
      (entry) => entry['@type'] === 'BlogPosting',
    );

    expect(article?.['dateModified']).toBe('2026-09-28T12:00:00.000Z');
  });

  it('keeps staging noindex even when a public canonical origin is configured', () => {
    TestBed.configureTestingModule({
      providers: [
        SeoService,
        {
          provide: Router,
          useClass: RouterStub,
        },
        {
          provide: Store,
          useClass: StoreStub,
        },
        {
          provide: REQUEST,
          useValue: new Request('https://staging.mimishow.de/blog/test-post'),
        },
        {
          provide: PUBLIC_ORIGIN,
          useValue: 'https://mimishow.de',
        },
      ],
    });

    TestBed.inject(SeoService).initialize();

    expect(
      document.head.querySelector<HTMLMetaElement>('meta[name="robots"]')?.content,
    ).toBe('noindex, nofollow');
    expect(
      document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href,
    ).toBe('https://mimishow.de/blog/test-post');
  });
});
