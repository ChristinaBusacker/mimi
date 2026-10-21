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

  it('accepts vertical column alignment and the featured gallery layout', () => {
    const input = document('1');
    const column = input.sections[0].rows[0].columns[0];
    column.contentAlign = 'end';
    column.blocks = [{ id: 'gallery', type: 'gallery', styles, layout: 'featured', items: [] }];
    expect(validateAlbumBooklet(input)).toEqual(input);
  });

  it('supports all gallery presets while retaining older galleries', () => {
    for (const layout of ['grid', 'featured', 'featuredRight', 'panorama', 'mosaic'] as const) {
      const input = document('1');
      input.sections[0].rows[0].columns[0].blocks = [
        { id: 'gallery', type: 'gallery', styles, layout, items: [] },
      ];
      expect(validateAlbumBooklet(input)).toEqual(input);
    }

    const legacy = document('1');
    legacy.sections[0].rows[0].columns[0].blocks = [
      { id: 'gallery', type: 'gallery', styles, items: [] },
    ];
    expect(validateAlbumBooklet(legacy)).toEqual(legacy);
  });

  it('replaces a legacy filmstrip preset with a normal grid without discarding images', () => {
    const input = document('1');
    input.sections[0].rows[0].columns[0].blocks = [
      { id: 'legacy-gallery', type: 'gallery', styles, layout: 'filmstrip' as 'grid', items: [] },
    ];
    const result = validateAlbumBooklet(input);
    const block = result.sections[0].rows[0].columns[0].blocks[0];
    expect(block.type).toBe('gallery');
    if (block.type === 'gallery') expect(block.layout).toBe('grid');
  });

  it('supports a slider and cards with localized editorial content', () => {
    const input = document('1');
    input.sections[0].rows[0].columns[0].blocks = [
      { id: 'slider', styles, type: 'slider', items: [] },
      { id: 'cards', styles, type: 'cardCarousel', items: [{
        id: 'card-1', assetId: null, alt: { de: '', en: '' },
        title: { de: 'Geschichte', en: 'Story' },
        description: { de: 'Hinter den Liedern', en: 'Behind the songs' },
        href: '/musik',
      }] },
    ];
    expect(validateAlbumBooklet(input)).toEqual(input);
    const invalid = structuredClone(input);
    const block = invalid.sections[0].rows[0].columns[0].blocks[1];
    if (block.type === 'cardCarousel') block.items[0].href = 'javascript:alert(1)';
    expect(() => validateAlbumBooklet(invalid)).toThrow(BadRequestException);
  });

  it('rejects duplicate card IDs across booklet blocks', () => {
    const input = document('1');
    input.sections[0].rows[0].columns[0].blocks = [
      { id: 'slider', styles, type: 'slider', items: [{
        id: 'repeated', assetId: '11111111-1111-4111-8111-111111111111', alt: { de: '', en: '' },
      }] },
      { id: 'cards', styles, type: 'cardCarousel', items: [{
        id: 'repeated', assetId: null, alt: { de: '', en: '' },
        title: { de: '', en: '' }, description: { de: '', en: '' }, href: '',
      }] },
    ];
    expect(() => validateAlbumBooklet(input)).toThrow(BadRequestException);
  });

  it('rejects arbitrary column alignment and gallery layouts', () => {
    const input = document('1');
    const column = input.sections[0].rows[0].columns[0];
    column.contentAlign = 'baseline' as 'start';
    expect(() => validateAlbumBooklet(input)).toThrow(BadRequestException);
    column.contentAlign = 'start';
    column.blocks = [{ id: 'gallery', type: 'gallery', styles, layout: 'tiles' as 'grid', items: [] }];
    expect(() => validateAlbumBooklet(input)).toThrow(BadRequestException);
  });

  it('accepts album details and track blocks without persisting duplicate album data', () => {
    const input = document('1');
    input.sections[0].rows[0].columns[0].blocks = [
      { id: 'details', styles, type: 'albumDetails' },
      { id: 'tracks', styles, type: 'albumTracks' },
    ];
    expect(validateAlbumBooklet(input)).toEqual(input);
  });

  it('canonicalizes editorial credits and rejects malformed ones', () => {
    const input = document('1');
    input.sections[0].rows[0].columns[0].blocks = [{
      id: 'credits', styles, type: 'albumCredits', heading: { de: 'Mitwirkende', en: 'Credits' },
      entries: [{ name: 'Mimi', role: { de: 'Musik', en: 'Music' } }],
    }];
    expect(validateAlbumBooklet(input)).toEqual(input);
    const invalidCredit = structuredClone(input);
    const block = invalidCredit.sections[0].rows[0].columns[0].blocks[0];
    if (block.type === 'albumCredits') block.entries[0].name = 'x'.repeat(121);
    expect(() => validateAlbumBooklet(invalidCredit)).toThrow(BadRequestException);
  });
  it('retains transparent surface controls on rows and validates colors', () => {
    const source = document('1');
    const rowStyles = source.sections[0].rows[0].styles;
    rowStyles.designBackground = { kind: 'gradient', from: '#11223344', to: '#abcdefcc', angle: 90 };
    rowStyles.corners = { topLeft: 3, topRight: 6, bottomRight: 9, bottomLeft: 12 };
    rowStyles.border = { width: 2, style: 'dashed', color: '#ffffff88' };
    rowStyles.shadow = { x: -4, y: 8, blur: 24, spread: -2, color: '#03040a55' };
    const parsed = validateAlbumBooklet(source);
    expect(parsed.sections[0].rows[0].styles).toEqual(rowStyles);

    const malformed = structuredClone(source);
    malformed.sections[0].rows[0].styles.border!.color = 'red; background: url(javascript:evil)';
    expect(() => validateAlbumBooklet(malformed)).toThrow(BadRequestException);
  });

  it('keeps responsive box values and separately validates heading colors', () => {
    const input = document('1');
    const section = input.sections[0];
    // Fixture nodes deliberately share `styles`; isolate mutations for this test.
    section.styles = { ...section.styles };
    section.styles.paddingBox = { top: 0, right: 8, bottom: 16, left: 8 };
    section.styles.marginBox = { top: 12, right: 0, bottom: 12, left: 0 };
    section.styles.responsive = { mobile: { paddingBox: { top: 4, right: 0, bottom: 4, left: 0 } } };
    const text = section.rows[0].columns[0].blocks[0];
    text.styles = { ...text.styles, headingColor: '#aa00cc88' };
    expect(validateAlbumBooklet(input).sections[0].styles).toEqual(section.styles);
    expect(validateAlbumBooklet(input).sections[0].rows[0].columns[0].blocks[0].styles.headingColor)
      .toBe('#aa00cc88');
    text.styles.headingColor = 'url(evil)';
    expect(() => validateAlbumBooklet(input)).toThrow(BadRequestException);
    delete text.styles.headingColor;
    section.styles.paddingBox!.top = -1;
    expect(() => validateAlbumBooklet(input)).toThrow(BadRequestException);
  });

  it('validates album palettes, slider options and automatic galleries', () => {
    const input = document('1');
    const blocks = input.sections[0].rows[0].columns[0].blocks;
    blocks.splice(0, blocks.length,
      { id: 'details', type: 'albumDetails', styles: {}, palette: {
        textColor: '#ffeeddff', backgroundColor: '#24152aaa', iconColor: '#daaabbff', subtitleColor: '#eeccdd99' } },
      { id: 'tracks', type: 'albumTracks', styles: {}, palette: { backgroundColor: '#11223344' } },
      { id: 'credits', type: 'albumCredits', styles: {}, heading: { de: 'Credits', en: 'Credits' },
        entries: [], palette: { textColor: '#abcdef88' } },
      { id: 'slider', type: 'slider', styles: {}, items: [], perView: 1.5, showBullets: true },
      { id: 'gallery', type: 'gallery', styles: {}, items: [], layout: 'auto' },
    );
    const parsed = validateAlbumBooklet(input).sections[0].rows[0].columns[0].blocks;
    expect(parsed[0]).toMatchObject({ type: 'albumDetails', palette: { iconColor: '#daaabbff' } });
    expect(parsed[1]).toMatchObject({ type: 'albumTracks', palette: { backgroundColor: '#11223344' } });
    expect(parsed[2]).toMatchObject({ type: 'albumCredits', palette: { textColor: '#abcdef88' } });
    expect(parsed[3]).toMatchObject({ type: 'slider', perView: 1.5, showBullets: true });
    expect(parsed[4]).toMatchObject({ type: 'gallery', layout: 'auto' });
    const bad = structuredClone(input);
    const slider = bad.sections[0].rows[0].columns[0].blocks[3];
    if (slider.type === 'slider') slider.perView = 5;
    expect(() => validateAlbumBooklet(bad)).toThrow(BadRequestException);
    const badColor = structuredClone(input);
    const details = badColor.sections[0].rows[0].columns[0].blocks[0];
    if (details.type === 'albumDetails') details.palette!.iconColor = 'red';
    expect(() => validateAlbumBooklet(badColor)).toThrow(BadRequestException);
  });

  it('supports a readable text shadow and rejects text shadow on containers', () => {
    const input = document('1');
    const textBlock = input.sections[0].rows[0].columns[0].blocks[0];
    textBlock.styles = { ...textBlock.styles, textShadow: 'readability', textColor: '#ffe0d988' };
    const result = validateAlbumBooklet(input);
    expect(result.sections[0].rows[0].columns[0].blocks[0].styles.textShadow).toBe('readability');
    expect(result.sections[0].rows[0].columns[0].blocks[0].styles.textColor).toBe('#ffe0d988');
    const invalid = structuredClone(input);
    invalid.sections[0].rows[0].styles.textShadow = 'strong';
    expect(() => validateAlbumBooklet(invalid)).toThrow(BadRequestException);
  });
});
