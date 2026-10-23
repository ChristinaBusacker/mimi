import type { PageBlock, PageDocument } from '@shared/content/page-document';
import { describe, expect, it } from 'vitest';

import { validatePageDocument } from './page-document-validation';

const base = { background: 'none' as const, padding: 0, gap: 16, radius: 0, align: 'left' as const };
const surface = {
  ...base,
  designBackground: { kind: 'color' as const, color: '#34233a99' },
  border: { width: 2, style: 'solid' as const, color: '#ffcceeaa' },
  corners: { topLeft: 12, topRight: 12, bottomRight: 8, bottomLeft: 8 },
  shadow: { x: 0, y: 8, blur: 20, spread: 0, color: '#00000088' },
};

function doc(block: PageBlock): PageDocument {
  return {
    id: 'page', schemaVersion: 1, styles: base,
    sections: [{ id: 'section', styles: base, rows: [{ id: 'row', styles: base, layout: '1',
      columns: [{ id: 'column', styles: base, blocks: [block] }],
    }] }],
  };
}

describe('Album Composer surface styling', () => {
  it('preserves general surface styling on all three album widgets', () => {
    const blocks: PageBlock[] = [
      { id: 'details', type: 'albumDetails', styles: surface },
      { id: 'tracks', type: 'albumTracks', styles: surface },
      { id: 'credits', type: 'albumCredits', styles: surface,
        heading: { de: 'Mitwirkende', en: 'Credits' }, entries: [] },
    ];
    for (const block of blocks) {
      const validated = validatePageDocument(doc(block), 'album');
      expect(validated.sections[0].rows[0].columns[0].blocks[0].styles).toEqual(surface);
      expect(() => validatePageDocument(doc(block), 'standard')).toThrow(/album blocks/);
    }
  });
  it('preserves surface styling and font overrides on text blocks', () => {
    const decorated = { ...surface, fontBody: 'open-sans', fontHeading: 'system-serif' };
    const text = { id: 'text', type: 'text' as const,
      styles: decorated, markdown: { de: 'Text', en: 'Text' } };
    const validated = validatePageDocument(doc(text), 'album');
    expect(validated.sections[0].rows[0].columns[0].blocks[0].styles).toEqual(decorated);
  });
  it('rejects unsupported borders and unsafe font identifiers', () => {
    const malformed = doc({ id: 'details', type: 'albumDetails', styles: {
      ...surface, border: { width: 14, style: 'solid', color: '#ffffff' },
    } });
    expect(() => validatePageDocument(malformed, 'album')).toThrow(/Invalid page document/);
    expect(() => validatePageDocument(doc({ id: 'text', type: 'text',
      styles: { ...base, fontBody: 'url(javascript:bad)' },
      markdown: { de: 'Text', en: 'Text' } }), 'album')).toThrow(/invalid text block font ID/);
  });
});
