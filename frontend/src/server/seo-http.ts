export interface SeoBlogPost {
  slug: string;
  title: string;
  excerpt: string;
  publishedAt: string;
  updatedAt: string;
  author: {
    displayName: string;
  };
  categories: readonly {
    name: string;
  }[];
}

export interface SeoBlogAuthor {
  slug: string;
}

export interface SeoMusicAlbum {
  slug: string;
  releasedAt: string | null;
}

export interface SeoContent {
  posts: readonly SeoBlogPost[];
  authors: readonly SeoBlogAuthor[];
  albums: readonly SeoMusicAlbum[];
}

export interface SitemapEntry {
  location: string;
  lastModified?: string;
}

interface SeoContentCacheEntry {
  expiresAt: number;
  value: SeoContent;
}

export class SeoContentCache {
  private entry: SeoContentCacheEntry | null = null;

  constructor(private readonly ttlMs: number) {}

  async get(
    loader: () => Promise<SeoContent>,
    now = Date.now(),
  ): Promise<SeoContent> {
    if (this.entry && this.entry.expiresAt > now) {
      return this.entry.value;
    }

    try {
      const value = await loader();

      this.entry = {
        expiresAt: now + this.ttlMs,
        value,
      };

      return value;
    } catch (error) {
      if (this.entry) {
        return this.entry.value;
      }

      throw error;
    }
  }
}

export function renderRobots(origin: string, indexable: boolean): string {
  if (!indexable) {
    return [
      'User-agent: *',
      'Disallow: /',
      '',
    ].join('\n');
  }

  return [
    'User-agent: *',
    'Allow: /',
    'Disallow: /admin',
    'Disallow: /account',
    'Disallow: /community/dashboard',
    'Disallow: /api/admin',
    'Disallow: /api/auth',
    'Disallow: /api/account',
    `Sitemap: ${origin}/sitemap.xml`,
    '',
  ].join('\n');
}

export function staticSitemapEntries(origin: string): SitemapEntry[] {
  return [
    '/',
    '/gaming',
    '/music',
    '/blog',
    '/videos',
    '/community',
    '/kontakt',
    '/unterstuetzen',
    '/impressum',
    '/datenschutz',
  ].map((path) => ({
    location: `${origin}${path}`,
  }));
}

export function renderSitemap(entries: readonly SitemapEntry[]): string {
  const urls = entries
    .map((entry) => {
      const lastModified = entry.lastModified
        ? `\n    <lastmod>${escapeXml(toIsoDate(entry.lastModified))}</lastmod>`
        : '';

      return [
        '  <url>',
        `    <loc>${escapeXml(entry.location)}</loc>${lastModified}`,
        '  </url>',
      ].join('\n');
    })
    .join('\n');

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    urls,
    '</urlset>',
    '',
  ].join('\n');
}

export function renderFeed(
  origin: string,
  posts: readonly SeoBlogPost[],
): string {
  const sortedPosts = [...posts]
    .sort(
      (left, right) =>
        Date.parse(right.publishedAt) -
        Date.parse(left.publishedAt),
    )
    .slice(0, 50);
  const latestUpdatedAt = sortedPosts.reduce<string | null>(
    (latest, post) =>
      !latest || Date.parse(post.updatedAt) > Date.parse(latest)
        ? post.updatedAt
        : latest,
    null,
  );
  const lastBuildDate = latestUpdatedAt
    ? `\n    <lastBuildDate>${escapeXml(toRssDate(latestUpdatedAt))}</lastBuildDate>`
    : '';
  const selfUrl = escapeXml(`${origin}/feed.xml`);
  const items = sortedPosts
    .map((post) => {
      const url = `${origin}/blog/${encodeURIComponent(post.slug)}`;
      const categories = post.categories
        .map(
          (category) =>
            `      <category>${escapeXml(category.name)}</category>`,
        )
        .join('\n');

      return [
        '    <item>',
        `      <title>${escapeXml(post.title)}</title>`,
        `      <link>${escapeXml(url)}</link>`,
        `      <guid isPermaLink="true">${escapeXml(url)}</guid>`,
        `      <description>${escapeXml(post.excerpt)}</description>`,
        `      <pubDate>${escapeXml(toRssDate(post.publishedAt))}</pubDate>`,
        `      <dc:creator>${escapeXml(post.author.displayName)}</dc:creator>`,
        categories,
        '    </item>',
      ]
        .filter(Boolean)
        .join('\n');
    })
    .join('\n');

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">',
    '  <channel>',
    '    <title>Mimishow News</title>',
    `    <link>${escapeXml(`${origin}/blog`)}</link>`,
    '    <description>News, Geschichten und Beiträge aus der Mimishow.</description>',
    '    <language>de-DE</language>',
    `    <atom:link href="${selfUrl}" rel="self" type="application/rss+xml" />${lastBuildDate}`,
    items,
    '  </channel>',
    '</rss>',
    '',
  ].join('\n');
}

function toIsoDate(value: string): string {
  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? value
    : date.toISOString().slice(0, 10);
}

function toRssDate(value: string): string {
  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? value
    : date.toUTCString();
}

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}
