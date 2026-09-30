import { InjectionToken } from '@angular/core';

export const SITE_NAME = 'Mimishow';
export const SITE_DEFAULT_IMAGE_PATH = '/images/hero-bg-music.png';

export const PUBLIC_ORIGIN = new InjectionToken<string | null>('PUBLIC_ORIGIN');

const INDEXABLE_HOSTS = new Set(['mimishow.de', 'www.mimishow.de']);

export function isIndexableHostname(hostname: string): boolean {
  return INDEXABLE_HOSTS.has(hostname.trim().toLowerCase());
}

export function normalizePublicOrigin(value: string | null | undefined): string | null {
  const normalized = value?.trim();

  if (!normalized) {
    return null;
  }

  let url: URL;

  try {
    url = new URL(normalized);
  } catch {
    throw new Error('PUBLIC_ORIGIN must be an absolute HTTP or HTTPS URL.');
  }

  if (
    (url.protocol !== 'http:' && url.protocol !== 'https:') ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      'PUBLIC_ORIGIN must contain only an HTTP or HTTPS origin, for example https://mimishow.de.',
    );
  }

  return url.origin;
}

export function assetSocialImagePath(assetId: string): string {
  return `/api/assets/${encodeURIComponent(assetId)}/image/social/fallback`;
}
