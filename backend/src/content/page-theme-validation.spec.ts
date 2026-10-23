import type { PageDocument } from '@shared/content/page-document';
import { describe, expect, it } from 'vitest';
import { validatePageDocument } from './page-document-validation';

const original = (): PageDocument => ({
  id: 'page', schemaVersion: 1,
  styles: { background: 'none', align: 'left', padding: 0, gap: 16, radius: 0 },
  sections: [],
});

describe('Page-document themes', () => {
  it('preserves older documents without adding a theme', () => {
    expect(validatePageDocument(original())).toEqual(original());
  });

  it('accepts and canonicalizes typed design tokens without publishing anything', () => {
    const document = original();
    document.theme = {
      fontBody: 'open-sans', fontHeading: 'emilys-candy',
      colors: { text: '#F5EAF2FF', heading: '#FFFFFF', accent: '#da8dbbff' },
      sizes: { body: 16, h1: 54, h2: 36 },
      responsive: { tablet: { h1: 42 }, mobile: { h1: 30 } },
      lineHeight: 1.6, letterSpacing: 0.2, contentMaxWidth: 1140, readingMaxWidth: 680,
    };
    const parsed = validatePageDocument(document);
    expect(parsed.theme?.sizes?.h1).toBe(54);
    expect(parsed.theme?.responsive?.mobile?.h1).toBe(30);
    expect(parsed.theme?.colors?.text).toBe('#f5eaf2ff');
  });

  it('rejects arbitrary CSS, excessive dimensions and unknown theme keys', () => {
    for (const theme of [
      { fontBody: 'url(javascript:evil)' },
      { colors: { text: 'expression(alert(1))' } },
      { sizes: { h1: 9999 } },
      { responsive: { desktop: { body: 18 } } },
      { contentMaxWidth: 99999 },
      { customCss: 'body { display:none }' },
    ]) {
      expect(() => validatePageDocument({ ...original(), theme } as unknown as PageDocument))
        .toThrow(/Invalid page document/);
    }
  });
});
