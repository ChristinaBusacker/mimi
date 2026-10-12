import type { ActivatedRouteSnapshot } from '@angular/router';
import { isBookletRoute, prepareBookletPortal } from './booklet-transition';

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

describe('Booklet cover portal', () => {
  afterEach(() => {
    document.body.replaceChildren();
    const root = document.documentElement;
    root.style.removeProperty('--booklet-portal-x');
    root.style.removeProperty('--booklet-portal-y');
    root.style.removeProperty('--booklet-portal-size');
  });

  it('captures the selected cover and clears a competing transition name', () => {
    const competing = document.createElement('img');
    competing.style.viewTransitionName = 'booklet-cover';
    const selected = document.createElement('img');
    Object.defineProperty(selected, 'naturalWidth', { value: 300 });
    selected.getBoundingClientRect = () => new DOMRect(100, 180, 160, 160);
    document.body.append(competing, selected);

    prepareBookletPortal(selected);

    expect(competing.style.viewTransitionName).toBe('none');
    expect(selected.style.viewTransitionName).toBe('booklet-cover');
    expect(document.documentElement.style.getPropertyValue('--booklet-portal-x')).toBe('180.0px');
    expect(document.documentElement.style.getPropertyValue('--booklet-portal-y')).toBe('260.0px');
  });

  it('uses a link as origin without promoting it to an album cover', () => {
    const link = document.createElement('a');
    link.getBoundingClientRect = () => new DOMRect(25, 45, 100, 40);
    document.body.append(link);

    prepareBookletPortal(link);

    expect(link.style.viewTransitionName).toBe('');
    expect(document.documentElement.style.getPropertyValue('--booklet-portal-x')).toBe('75.0px');
  });
});
