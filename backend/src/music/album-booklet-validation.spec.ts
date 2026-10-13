import { BadRequestException } from '@nestjs/common';
import type { PageDocument, RowLayout } from '@shared/content/page-document';
import { PAGE_ROW_LAYOUTS } from '@shared/content/page-layouts';
import { validateAlbumBooklet } from './album-booklet-validation';

const styles = { background: 'none' as const, padding: 12, gap: 18, radius: 8, align: 'left' as const };

function document(layout: RowLayout): PageDocument {
  return {
    id: 'page', schemaVersion: 1, styles,
    sections: [{
      id: 'section', styles,
      rows: [{
        id: 'row', layout, styles,
        columns: PAGE_ROW_LAYOUTS[layout].map((_, index) => ({
          id: `column-${index}`, styles,
          blocks: [{ id: `text-${index}`, type: 'text' as const, styles, markdown: { de: '**Hallo**', en: '**Hello**' } }],
        })),
      }],
    }],
  };
}

describe('Album booklet document validation', () => {
  it('supports all eleven fixed column layouts', () => {
    for (const layout of Object.keys(PAGE_ROW_LAYOUTS) as RowLayout[]) {
      expect(validateAlbumBooklet(document(layout)).sections[0].rows[0].layout).toBe(layout);
    }
  });

  it('does not allow a layout with a mismatched number of columns', () => {
    const invalid = document('1-1');
    invalid.sections[0].rows[0].columns.pop();
    expect(() => validateAlbumBooklet(invalid)).toThrow(BadRequestException);
  });

  it('rejects arbitrary design values and duplicate element IDs', () => {
    const invalid = document('1-1');
    invalid.sections[0].styles.background = 'url(javascript:evil)' as 'none';
    expect(() => validateAlbumBooklet(invalid)).toThrow(BadRequestException);
    invalid.sections[0].styles.background = 'none';
    invalid.sections[0].rows[0].columns[1].id = invalid.sections[0].rows[0].columns[0].id;
    expect(() => validateAlbumBooklet(invalid)).toThrow(BadRequestException);
  });

  it('removes unknown keys instead of persisting arbitrary JSON', () => {
    const input = { ...document('1'), unexpected: 'ignored' };
    expect('unexpected' in validateAlbumBooklet(input)).toBe(false);
  });
});
