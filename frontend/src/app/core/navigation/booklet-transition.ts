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

/** Only the transition across the Mimishow/booklet boundary gets the portal animation. */
export function onBookletTransitionCreated(info: ViewTransitionInfo): void {
  const fromBooklet = isBookletRoute(info.from);
  const toBooklet = isBookletRoute(info.to);

  if (
    fromBooklet === toBooklet ||
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ) {
    info.transition.skipTransition();
    return;
  }

  const direction = toBooklet ? 'enter' : 'leave';
  const root = document.documentElement;
  root.dataset['bookletTransition'] = direction;

  const cleanup = (): void => {
    if (root.dataset['bookletTransition'] === direction) {
      delete root.dataset['bookletTransition'];
    }
  };

  void info.transition.finished.then(cleanup, cleanup);
}
