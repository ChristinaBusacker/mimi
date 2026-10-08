export const REVALIDATE_CACHE_CONTROL = 'no-cache, max-age=0, must-revalidate';
export const IMMUTABLE_CACHE_CONTROL = 'public, max-age=31536000, immutable';

/** Only fingerprinted build bundles may be cached without revalidation. */
export function staticCacheControl(fileName: string): string {
  return /[.-][a-z0-9]{8,}\.(?:css|js|mjs)$/i.test(fileName)
    ? IMMUTABLE_CACHE_CONTROL
    : REVALIDATE_CACHE_CONTROL;
}
