import {
  SeoContentCache,
  type SeoBlogPost,
  type SeoContent,
  renderFeed,
  renderRobots,
  renderSitemap,
  staticSitemapEntries,
} from './seo-http';

const posts: SeoBlogPost[] = [
  {
    slug: 'older-post',
    title: 'Older & wiser',
    excerpt: 'Older <story>',
    publishedAt: '2026-09-01T10:00:00.000Z',
    updatedAt: '2026-09-28T12:00:00.000Z',
    author: {
      displayName: 'Mimi & Team',
    },
    categories: [
      {
        name: 'News & stories',
      },
    ],
  },
  {
    slug: 'newer-post',
    title: 'Newer post',
    excerpt: 'The newer publication.',
    publishedAt: '2026-09-20T10:00:00.000Z',
    updatedAt: '2026-09-21T10:00:00.000Z',
    author: {
      displayName: 'Mimi',
    },
    categories: [],
  },
];

const seoContent: SeoContent = {
  posts,
  authors: [],
  albums: [],
};

describe('SEO HTTP helpers', () => {
  it('renders an indexable robots file with crawl exclusions and sitemap', () => {
    const robots = renderRobots('https://mimishow.de', true);

    expect(robots).toContain('Allow: /');
    expect(robots).toContain('Disallow: /admin');
    expect(robots).toContain('Disallow: /api/auth');
    expect(robots).toContain('Sitemap: https://mimishow.de/sitemap.xml');
  });

  it('blocks all crawling for non-indexable hosts', () => {
    expect(renderRobots('https://staging.mimishow.de', false)).toBe(
      'User-agent: *\nDisallow: /\n',
    );
  });

  it('includes the about page in static sitemap entries', () => {
    expect(
      staticSitemapEntries('https://mimishow.de'),
    ).toContainEqual({
      location: 'https://mimishow.de/about',
    });
  });

  it('renders sitemap URLs, escaping XML and normalizing lastmod to a date', () => {
    const sitemap = renderSitemap([
      {
        location: 'https://mimishow.de/blog/music&news',
        lastModified: '2026-09-28T12:34:56.000Z',
      },
    ]);

    expect(sitemap).toContain(
      '<loc>https://mimishow.de/blog/music&amp;news</loc>',
    );
    expect(sitemap).toContain('<lastmod>2026-09-28</lastmod>');
  });

  it('keeps RSS publication order while using the newest update as lastBuildDate', () => {
    const feed = renderFeed('https://mimishow.de', posts);
    const olderIndex = feed.indexOf('<title>Older &amp; wiser</title>');
    const newerIndex = feed.indexOf('<title>Newer post</title>');

    expect(newerIndex).toBeGreaterThan(-1);
    expect(olderIndex).toBeGreaterThan(newerIndex);
    expect(feed).toContain(
      '<lastBuildDate>Mon, 28 Sep 2026 12:00:00 GMT</lastBuildDate>',
    );
    expect(feed).toContain('<description>Older &lt;story&gt;</description>');
  });
});

describe('SeoContentCache', () => {
  it('reuses fresh content without loading it again', async () => {
    const cache = new SeoContentCache(1_000);
    let loads = 0;
    const loader = async (): Promise<SeoContent> => {
      loads += 1;
      return seoContent;
    };

    await cache.get(loader, 1_000);
    const cached = await cache.get(loader, 1_500);

    expect(cached).toBe(seoContent);
    expect(loads).toBe(1);
  });

  it('returns stale last-good content when a refresh fails', async () => {
    const cache = new SeoContentCache(1_000);

    await cache.get(async () => seoContent, 1_000);

    const stale = await cache.get(
      async () => {
        throw new Error('backend unavailable');
      },
      2_500,
    );

    expect(stale).toBe(seoContent);
  });

  it('propagates a load error when no last-good content exists', async () => {
    const cache = new SeoContentCache(1_000);

    await expect(
      cache.get(async () => {
        throw new Error('backend unavailable');
      }),
    ).rejects.toThrow('backend unavailable');
  });
});
