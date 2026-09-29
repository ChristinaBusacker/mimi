import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express, { type Request } from 'express';
import { basename, join } from 'node:path';

import { isIndexableHostname } from './app/core/seo/seo.config';

interface SeoBlogPost {
  slug: string;
  title: string;
  excerpt: string;
  publishedAt: string;
  author: {
    displayName: string;
  };
  categories: readonly {
    name: string;
  }[];
}

interface SeoBlogAuthor {
  slug: string;
}

interface SeoMusicAlbum {
  slug: string;
  releasedAt: string | null;
}

interface SeoContent {
  posts: readonly SeoBlogPost[];
  authors: readonly SeoBlogAuthor[];
  albums: readonly SeoMusicAlbum[];
}

interface SeoContentCache {
  expiresAt: number;
  value: SeoContent;
}

const browserDistFolder = join(import.meta.dirname, '../browser');
const backendOrigin = (
  process.env['BACKEND_ORIGIN']?.trim() ||
  'http://127.0.0.1:3000'
).replace(/\/+$/, '');
const seoCacheTtlMs = 5 * 60 * 1000;

const app = express();
const angularApp = new AngularNodeAppEngine();

let seoContentCache: SeoContentCache | null = null;

const noCacheStaticFiles = new Set([
  'index.csr.html',
  'index.html',
  'manifest.webmanifest',
  'ngsw-worker.js',
  'ngsw.json',
  'safety-worker.js',
  'worker-basic.min.js',
]);

app.get('/robots.txt', (request, response) => {
  const origin = requestOrigin(request);
  const hostname = new URL(origin).hostname;

  response.type('text/plain');
  response.setHeader('Cache-Control', 'public, max-age=3600');

  if (!isIndexableHostname(hostname)) {
    response.send([
      'User-agent: *',
      'Disallow: /',
      '',
    ].join('\n'));

    return;
  }

  response.send([
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
  ].join('\n'));
});

app.get('/sitemap.xml', async (request, response) => {
  const origin = requestOrigin(request);
  const entries = staticSitemapEntries(origin);

  try {
    const content = await loadSeoContent();

    entries.push(
      ...content.posts.map((post) => ({
        location: `${origin}/blog/${encodeURIComponent(post.slug)}`,
        lastModified: post.publishedAt,
      })),
      ...content.authors.map((author) => ({
        location: `${origin}/blog/autoren/${encodeURIComponent(author.slug)}`,
      })),
      ...content.albums.map((album) => ({
        location: `${origin}/music/albums/${encodeURIComponent(album.slug)}`,
        lastModified: album.releasedAt ?? undefined,
      })),
    );
  } catch (error) {
    console.warn(
      'Could not load dynamic sitemap entries. Serving the static sitemap.',
      error,
    );
  }

  response.type('application/xml');
  response.setHeader('Cache-Control', 'public, max-age=300');
  response.send(renderSitemap(entries));
});

app.get('/feed.xml', async (request, response) => {
  const origin = requestOrigin(request);

  try {
    const content = await loadSeoContent();

    response.type('application/rss+xml');
    response.setHeader('Cache-Control', 'public, max-age=300');
    response.send(renderFeed(origin, content.posts));
  } catch (error) {
    console.warn('Could not build the RSS feed.', error);
    response
      .status(503)
      .type('text/plain')
      .send('The RSS feed is temporarily unavailable.');
  }
});

/**
 * Serve static files from /browser
 */
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
    setHeaders: (response, filePath) => {
      if (noCacheStaticFiles.has(basename(filePath))) {
        response.setHeader('Cache-Control', 'no-cache');
      }
    },
  }),
);

/**
 * Handle all other requests by rendering the Angular application.
 */
app.use((req, res, next) => {
  angularApp
    .handle(req)
    .then((response) =>
      response ? writeResponseToNodeResponse(response, res) : next(),
    )
    .catch(next);
});

/**
 * Start the server if this module is the main entry point, or it is ran via PM2.
 * The server listens on the port defined by the `PORT` environment variable, or defaults to 4000.
 */
if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, (error) => {
    if (error) {
      throw error;
    }

    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

/**
 * Request handler used by the Angular CLI (for dev-server and during build) or Firebase Cloud Functions.
 */
export const reqHandler = createNodeRequestHandler(app);

async function loadSeoContent(): Promise<SeoContent> {
  const now = Date.now();

  if (seoContentCache && seoContentCache.expiresAt > now) {
    return seoContentCache.value;
  }

  try {
    const [posts, authors, albums] = await Promise.all([
      fetchJson<SeoBlogPost[]>('/api/blog/posts?locale=de'),
      fetchJson<SeoBlogAuthor[]>('/api/blog/authors'),
      fetchJson<SeoMusicAlbum[]>('/api/music/albums?locale=de'),
    ]);
    const value: SeoContent = {
      posts,
      authors,
      albums,
    };

    seoContentCache = {
      expiresAt: now + seoCacheTtlMs,
      value,
    };

    return value;
  } catch (error) {
    if (seoContentCache) {
      return seoContentCache.value;
    }

    throw error;
  }
}

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(`${backendOrigin}${path}`, {
    headers: {
      accept: 'application/json',
    },
    signal: AbortSignal.timeout(5000),
  });

  if (!response.ok) {
    throw new Error(
      `SEO source request failed with ${response.status} for ${path}.`,
    );
  }

  return response.json() as Promise<T>;
}

function requestOrigin(request: Request): string {
  const forwardedProto = firstForwardedValue(
    request.get('x-forwarded-proto'),
  );
  const forwardedHost = firstForwardedValue(
    request.get('x-forwarded-host'),
  );
  const protocol = forwardedProto || request.protocol;
  const host = forwardedHost || request.get('host') || 'localhost';

  return `${protocol}://${host}`;
}

function firstForwardedValue(value: string | undefined): string {
  return value?.split(',')[0]?.trim() ?? '';
}

function staticSitemapEntries(
  origin: string,
): {
  location: string;
  lastModified?: string;
}[] {
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

function renderSitemap(
  entries: readonly {
    location: string;
    lastModified?: string;
  }[],
): string {
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

function renderFeed(
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
  const latestPublishedAt = sortedPosts[0]?.publishedAt;
  const lastBuildDate = latestPublishedAt
    ? `\n    <lastBuildDate>${escapeXml(toRssDate(latestPublishedAt))}</lastBuildDate>`
    : '';
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
    `    <atom:link href="${escapeXml(`${origin}/feed.xml`)}" rel="self" type="application/rss+xml" />${lastBuildDate}`,
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
