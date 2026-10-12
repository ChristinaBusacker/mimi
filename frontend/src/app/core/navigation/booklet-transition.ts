import type { ActivatedRouteSnapshot, ViewTransitionInfo } from '@angular/router';

/** Album worlds change the application shell, but keep the same audio engine. */
export function isBookletRoute(snapshot: ActivatedRouteSnapshot): boolean {
  let route: ActivatedRouteSnapshot | null = snapshot;

  while (route) {
    if (route.data['layout'] === 'booklet') return true;
    route = route.firstChild;
  }

  return false;
}

/**
 * Captures the artwork's location before RouterLink starts navigation.
 * Only one visible element may own the shared transition name at a time.
 * A DOM cover is intentional: the Three.js stage remains presentation-only.
 */
function resetPortalOrigin(): void {
  const root = document.documentElement;
  root.style.removeProperty('--booklet-portal-x');
  root.style.removeProperty('--booklet-portal-y');
  root.style.removeProperty('--booklet-portal-size');
}

function setPortalOrigin(source: Element | null): void {
  if (!(source instanceof HTMLElement)) {
    resetPortalOrigin();
    return;
  }

  const bounds = source.getBoundingClientRect();
  const x = Math.max(0, Math.min(window.innerWidth, bounds.left + bounds.width / 2));
  const y = Math.max(0, Math.min(window.innerHeight, bounds.top + bounds.height / 2));
  const root = document.documentElement;
  root.style.setProperty('--booklet-portal-x', `${x.toFixed(1)}px`);
  root.style.setProperty('--booklet-portal-y', `${y.toFixed(1)}px`);
  root.style.setProperty('--booklet-portal-size', `${Math.max(28, bounds.width * 0.55).toFixed(1)}px`);
}

export function prepareBookletPortal(source: Element | null): void {
  // The music hero and the carousel can show the same album at once.
  // Prevent duplicate view-transition-name values before the old snapshot.
  document.querySelectorAll<HTMLElement>('[style*="booklet-cover"]').forEach((element) => {
    element.style.viewTransitionName = 'none';
  });

  setPortalOrigin(source);

  // A link is a useful fallback origin but should not morph into the album art.
  if (source instanceof HTMLImageElement && source.naturalWidth > 0) {
    source.style.viewTransitionName = 'booklet-cover';
  }
}

function routePath(snapshot: ActivatedRouteSnapshot): string | null {
  let route: ActivatedRouteSnapshot | null = snapshot;
  let path: string | null = null;

  while (route) {
    if (route.routeConfig?.path !== undefined) path = route.routeConfig.path;
    route = route.firstChild;
  }

  return path;
}

/** Only the Mimishow-to-album and album-to-music journeys get the portal animation. */
export function onBookletTransitionCreated(info: ViewTransitionInfo): void {
  const fromBooklet = isBookletRoute(info.from);
  const toBooklet = isBookletRoute(info.to);

  if (
    fromBooklet === toBooklet ||
    toBooklet ||
    (fromBooklet && routePath(info.to) !== 'music') ||
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ) {
    info.transition.skipTransition();
    return;
  }

  // Entry is managed by AlbumDiveService after the cover fills the viewport.
  // The native transition is retained solely for the return journey.
  const direction = 'leave';
  const root = document.documentElement;
  root.dataset['bookletTransition'] = direction;

  const cleanup = (): void => {
    if (root.dataset['bookletTransition'] === direction) {
      delete root.dataset['bookletTransition'];
    }
    resetPortalOrigin();
  };

  void info.transition.finished.then(cleanup, cleanup);
}
