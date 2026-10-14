import { BadRequestException } from '@nestjs/common';
import type { PageDocument } from '@shared/content/page-document';
import { validateAlbumBooklet } from './album-booklet-validation';

const ASSET_ID = '9e40f4d2-c323-4a39-8d71-1f9bbaf8c14e';

function booklet(): PageDocument {
  return {
    id: 'page', schemaVersion: 1, styles: {},
    sections: [{
      id: 'section', styles: {},
      rows: [{
        id: 'row', layout: '1', styles: {},
        columns: [{ id: 'column', styles: {}, blocks: [] }],
      }],
    }],
  };
}

describe('Booklet design controls', () => {
  it('accepts semantic section spacing and a structured gradient', () => {
    const input = booklet();
    input.sections[0].styles = {
      spacing: 'standard',
      designBackground: { kind: 'gradient', from: '#845877', to: '#231a35', angle: 135 },
    };
    const result = validateAlbumBooklet(input);
    expect(result.sections[0].styles.designBackground).toEqual(input.sections[0].styles.designBackground);
    expect(result.sections[0].styles.spacing).toBe('standard');
  });

  it('accepts decorative image backgrounds only for sections and columns', () => {
    const input = booklet();
    input.sections[0].rows[0].columns[0].styles.designBackground = {
      kind: 'image', assetId: ASSET_ID, position: 'center', overlay: 'soft',
    };
    expect(() => validateAlbumBooklet(input)).not.toThrow();
    input.sections[0].rows[0].styles.designBackground = {
      kind: 'color', color: '#ffffff',
    };
    expect(() => validateAlbumBooklet(input)).toThrow(BadRequestException);
  });

  it('rejects CSS injection and invalid asset identifiers', () => {
    const input = booklet();
    input.sections[0].styles.designBackground = {
      kind: 'image', assetId: 'javascript:alert(1)', position: 'center', overlay: 'soft',
    };
    expect(() => validateAlbumBooklet(input)).toThrow(BadRequestException);
    input.sections[0].styles.designBackground = {
      kind: 'gradient', from: '#845877', to: 'url(javascript:alert(1))', angle: 135,
    };
    expect(() => validateAlbumBooklet(input)).toThrow(BadRequestException);
  });

  it('preserves legacy numeric styles without exposing them in the editorial UI', () => {
    const input = booklet();
    input.sections[0].styles.padding = 37;
    input.sections[0].styles.background = 'glass';
    const result = validateAlbumBooklet(input);
    expect(result.sections[0].styles.padding).toBe(37);
    expect(result.sections[0].styles.background).toBe('glass');
  });
});
