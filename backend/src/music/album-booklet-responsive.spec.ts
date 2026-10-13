import { BadRequestException } from '@nestjs/common';
import type { PageDocument } from '@shared/content/page-document';
import { validateAlbumBooklet } from './album-booklet-validation';

function example(): PageDocument {
  return {
    id: 'page', schemaVersion: 1, styles: { background: 'none' },
    sections: [{ id: 's', styles: {}, rows: [{
      id: 'r', styles: {}, layout: '1-2', columns: [
        { id: 'a', styles: {}, blocks: [] },
        { id: 'b', styles: {}, blocks: [] },
      ],
    }] }],
  };
}

describe('Page composer responsive styles', () => {
  it('retains valid color and breakpoint overrides', () => {
    const value = example();
    value.sections[0].styles = {
      backgroundColor: '#aaccee', responsive: {
        tablet: { padding: 30 }, mobile: { padding: 12, textColor: '#ffffff' },
      },
    };
    const normalized = validateAlbumBooklet(value);
    expect(normalized.sections[0].styles.responsive?.mobile?.padding).toBe(12);
    expect(normalized.sections[0].styles.backgroundColor).toBe('#aaccee');
  });

  it('rejects arbitrary CSS values and unknown breakpoint keys', () => {
    const value = example();
    value.styles.backgroundColor = 'url(javascript:evil)';
    expect(() => validateAlbumBooklet(value)).toThrow(BadRequestException);
    value.styles.backgroundColor = '#112233';
    (value.styles as unknown as { responsive: object }).responsive = { widescreen: { gap: 12 } };
    expect(() => validateAlbumBooklet(value)).toThrow(BadRequestException);
  });
});
