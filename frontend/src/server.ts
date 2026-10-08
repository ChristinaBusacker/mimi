import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express, { type Request } from 'express';
import { basename, join } from 'node:path';

import {
  REVALIDATE_CACHE_CONTROL,
  staticCacheControl,
} from './server/cache-control';

import {
  isIndexableHostname,
  normalizePublicOrigin,
} from './app/core/seo/seo.config';
import {
  SeoContentCache,
  type SeoBlogAuthor,
  type SeoBlogPost,
  type SeoContent,
  type SeoMusicAlbum,
  renderFeed,
  renderRobots,
  renderSitemap,
  staticSitemapEntries,
} from './server/seo-http';

const browserDistFolder = join(import.meta.dirname, '../browser');
const internalApiBaseUrl = (
  process.env['MIMI_API_INTERNAL_URL'] ?? 'http://127.0.0.1:3000/api'
).replace(/\/+$/, '');
const publicOrigin = normalizePublicOrigin(process.env['PUBLIC_ORIGIN']);
const seoContentCache = new SeoContentCache(5 * 60 * 1000);

const app = express();
const angularApp = new AngularNodeAppEngine();


app.get('/robots.txt', (request, response) => {
  const requestUrlOrigin = requestOrigin(request);
  const origin = publicOrigin ?? requestUrlOrigin;
  const hostname = new URL(requestUrlOrigin).hostname;

  response.type('text/plain');
  response.setHeader('Cache-Control', 'public, max-age=3600');
  response.send(renderRobots(origin, isIndexableHostname(hostname)));
});

app.get('/sitemap.xml', async (request, response) => {
  const origin = publicOrigin ?? requestOrigin(request);
  const entries = staticSitemapEntries(origin);

  try {
    const content = await loadSeoContent();

    entries.push(
      ...content.posts.map((post) => ({
        location: `${origin}/blog/${encodeURIComponent(post.slug)}`,
        lastModified: post.updatedAt,
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
  const origin = publicOrigin ?? requestOrigin(request);

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
    maxAge: 0,
    index: false,
    redirect: false,
    setHeaders: (response, filePath) => {
      response.setHeader('Cache-Control', staticCacheControl(basename(filePath)));
    },
  }),
);

/**
 * Handle all other requests by rendering the Angular application.
 */
app.use((req, res, next) => {
  angularApp
    .handle(req)
    .then((response) => {
      if (!response) {
        next();
        return;
      }

      // SSR HTML must always be revalidated after a deployment.
      if (response.headers.get('content-type')?.includes('text/html')) {
        response.headers.set('Cache-Control', REVALIDATE_CACHE_CONTROL);
      }

      return writeResponseToNodeResponse(response, res);
    })
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

function loadSeoContent(): Promise<SeoContent> {
  return seoContentCache.get(async () => {
    const [posts, authors, albums] = await Promise.all([
      fetchJson<SeoBlogPost[]>('/blog/posts?locale=de'),
      fetchJson<SeoBlogAuthor[]>('/blog/authors'),
      fetchJson<SeoMusicAlbum[]>('/music/albums?locale=de'),
    ]);

    return {
      posts,
      authors,
      albums,
    };
  });
}

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(`${internalApiBaseUrl}${path}`, {
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
