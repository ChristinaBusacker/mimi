/** Explicit subset of icons actually implemented by app-icon. */
export const PAGE_COMPOSER_ICONS = [
  'arrow', 'arrow2', 'check', 'circle', 'community', 'deezer', 'folder', 'gallery',
  'heart', 'images', 'link', 'list-checked', 'list-numbered', 'lock', 'lock-open',
  'music', 'news', 'palette', 'play', 'plus', 'quote', 'search', 'spotify', 'twitch', 'youtube',
] as const;
export type PageComposerIconName = (typeof PAGE_COMPOSER_ICONS)[number];
export function pageComposerIconName(value: string): boolean {
  return (PAGE_COMPOSER_ICONS as readonly string[]).includes(value);
}
/** Accept only same-site paths or secure absolute URLs (no // protocol-relative links). */
export function validComposerDestination(href: string): boolean {
  if (!href) return true;
  if (href.length > 800 || /[<>]/.test(href) || href.includes(String.fromCharCode(92)) || Array.from(href).some((ch) => /\s/.test(ch))) return false;
  if (href.startsWith('/') && !href.startsWith('//')) return true;
  try {
    const url = new URL(href);
    return url.protocol === 'https:' && Boolean(url.hostname) && !url.username && !url.password;
  } catch {
    return false;
  }
}
