import { routes } from '../../app.routes';
import { systemSitePageResolver } from './system-page.resolver';

describe('system pages migration routing', () => {
  it.each(['about', 'impressum', 'datenschutz'])(
    'retains /%s as an explicit route resolved before the custom-page catch-all', (slug) => {
      const system = routes.find((route) => route.path === slug);
      const catchAllIndex = routes.findIndex((route) => route.path === ':slug');
      const systemIndex = routes.findIndex((route) => route.path === slug);
      expect(system?.data?.['systemSlug']).toBe(slug);
      expect(system?.resolve?.['data']).toBe(systemSitePageResolver);
      expect(systemIndex).toBeGreaterThan(-1);
      expect(systemIndex).toBeLessThan(catchAllIndex);
    },
  );
});
