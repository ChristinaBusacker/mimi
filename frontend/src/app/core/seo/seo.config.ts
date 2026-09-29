export const SITE_NAME = 'Mimishow';
export const SITE_DEFAULT_IMAGE_PATH = '/images/hero-bg-music.png';

const INDEXABLE_HOSTS = new Set(['mimishow.de', 'www.mimishow.de']);

export function isIndexableHostname(hostname: string): boolean {
  return INDEXABLE_HOSTS.has(hostname.trim().toLowerCase());
}
