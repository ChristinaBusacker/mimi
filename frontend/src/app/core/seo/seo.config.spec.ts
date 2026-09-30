import {
  assetSocialImagePath,
  normalizePublicOrigin,
} from './seo.config';

describe('SEO config', () => {
  it('normalizes a configured public origin', () => {
    expect(normalizePublicOrigin(' https://mimishow.de/ ')).toBe(
      'https://mimishow.de',
    );
  });

  it('rejects a public origin containing a path', () => {
    expect(() => normalizePublicOrigin('https://mimishow.de/site')).toThrow(
      'PUBLIC_ORIGIN must contain only an HTTP or HTTPS origin',
    );
  });

  it('builds the 1200 by 630 social image route', () => {
    expect(assetSocialImagePath('asset/id')).toBe(
      '/api/assets/asset%2Fid/image/social/fallback',
    );
  });
});
