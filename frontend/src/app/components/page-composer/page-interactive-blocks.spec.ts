import { describe, expect, it } from 'vitest';
import { PAGE_COMPOSER_ICONS, validComposerDestination } from './page-interactive-blocks';

describe('Composer navigation and icon choices', () => {
  it('rejects unsafe URLs while accepting internal links and HTTPS addresses', () => {
    expect(validComposerDestination('/music/albums/hello')).toBe(true);
    expect(validComposerDestination('https://example.com/album')).toBe(true);
    for (const href of ['javascript:alert(1)', 'http://example.com', '//example.com',
      '/bad path', 'https://user:password@example.com', 'https://example.com\oops']) {
      expect(validComposerDestination(href)).toBe(false);
    }
  });
  it('offers only defined names with no duplicates', () => {
    expect(PAGE_COMPOSER_ICONS).toContain('heart');
    expect(new Set(PAGE_COMPOSER_ICONS).size).toBe(PAGE_COMPOSER_ICONS.length);
  });
});
