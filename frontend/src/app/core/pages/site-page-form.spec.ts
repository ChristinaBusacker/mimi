import { createSitePageInput, emptySitePageDocument, hasPublishableDocument, validSitePageMetadata } from './site-page-form';

describe('site page admin forms', () => {
  it('creates bilingual metadata with stable, explicit slugs', () => {
    expect(createSitePageInput('our-team', ' Unser Team ', ' Our team ')).toEqual({
      slug: 'our-team',
      metadata: {
        title: { de: 'Unser Team', en: 'Our team' },
        seoTitle: { de: 'Unser Team', en: 'Our team' },
        seoDescription: { de: '', en: '' }, seoImageAssetId: null, indexable: true,
      },
    });
  });

  it('rejects reserved patterns and incomplete titles before posting', () => {
    for (const slug of ['About', 'my page', 'bad/', '-bad', 'bad-', 'foo--bar', '']) {
      expect(createSitePageInput(slug, 'DE', 'EN')).toBeNull();
    }
    expect(createSitePageInput('valid', 'DE', '')).toBeNull();
    expect(createSitePageInput('valid', 'DE', 'x'.repeat(161))).toBeNull();
  });

  it('validates both locales and SEO field lengths', () => {
    const metadata = createSitePageInput('demo', 'Deutsch', 'English')!.metadata;
    expect(validSitePageMetadata(metadata)).toBe(true);
    expect(validSitePageMetadata({ ...metadata, title: { de: '', en: 'English' } })).toBe(false);
    expect(validSitePageMetadata({ ...metadata, seoDescription: { de: 'x'.repeat(501), en: '' } })).toBe(false);
  });

  it('starts empty and blocks publication until a section exists', () => {
    const document = emptySitePageDocument();
    expect(hasPublishableDocument(document)).toBe(false);
    expect(hasPublishableDocument({ ...document, sections: [{ id: 's', styles: {}, rows: [] }] })).toBe(true);
  });
});
