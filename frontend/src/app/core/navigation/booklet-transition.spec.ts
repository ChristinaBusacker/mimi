import type { ActivatedRouteSnapshot } from '@angular/router';
import { isBookletRoute } from './booklet-transition';

describe('Booklet route', () => {
  it('recognizes a nested booklet layout', () => {
    const root = {
      data: {},
      firstChild: { data: { layout: 'booklet' }, firstChild: null },
    } as unknown as ActivatedRouteSnapshot;
    expect(isBookletRoute(root)).toBe(true);
  });

  it('does not switch the shell for a normal route', () => {
    const root = {
      data: {},
      firstChild: { data: {}, firstChild: null },
    } as unknown as ActivatedRouteSnapshot;
    expect(isBookletRoute(root)).toBe(false);
  });
});
