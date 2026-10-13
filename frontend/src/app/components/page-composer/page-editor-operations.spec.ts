import type { PageDocument } from '@shared/content/page-document';
import { insertPageItem, movePageItem } from './page-editor-operations';

function document(): PageDocument {
  return {
    schemaVersion: 1, id: 'page', styles: {},
    sections: [
      { id: 's1', styles: {}, rows: [{
        id: 'r1', layout: '1-1', styles: {}, columns: [
          { id: 'c1', styles: {}, blocks: [
            { id: 'b1', type: 'text', styles: {}, markdown: { de: 'A', en: 'A' } },
            { id: 'b2', type: 'text', styles: {}, markdown: { de: 'B', en: 'B' } },
          ] },
          { id: 'c2', styles: {}, blocks: [] },
        ],
      }] },
      { id: 's2', styles: {}, rows: [] },
    ],
  };
}

describe('Page composer moves', () => {
  it('reorders sections without modifying the source', () => {
    const original = document();
    const updated = movePageItem(original, 'section', 's2', 'page', 0);
    expect(updated?.sections.map((item) => item.id)).toEqual(['s2', 's1']);
    expect(original.sections.map((item) => item.id)).toEqual(['s1', 's2']);
  });
  it('moves blocks between columns with unchanged content and IDs', () => {
    const updated = movePageItem(document(), 'block', 'b1', 'c2', 0);
    expect(updated?.sections[0].rows[0].columns[0].blocks.map((item) => item.id)).toEqual(['b2']);
    expect(updated?.sections[0].rows[0].columns[1].blocks[0]).toMatchObject({ id: 'b1', markdown: { de: 'A' } });
  });
  it('reorders blocks without an off-by-one insertion', () => {
    const updated = movePageItem(document(), 'block', 'b1', 'c1', 2);
    expect(updated?.sections[0].rows[0].columns[0].blocks.map((item) => item.id)).toEqual(['b2', 'b1']);
  });
  it('rejects invalid destinations and no-op moves', () => {
    expect(movePageItem(document(), 'block', 'b1', 'r1', 0)).toBeNull();
    expect(movePageItem(document(), 'block', 'b1', 'c1', 1)).toBeNull();
  });
  it('moves a complete row into another section without losing its columns', () => {
    const original = document();
    const updated = movePageItem(original, 'row', 'r1', 's2', 0);
    expect(updated?.sections[0].rows).toHaveLength(0);
    expect(updated?.sections[1].rows[0].columns[0].blocks.map((block) => block.id)).toEqual(['b1', 'b2']);
    expect(original.sections[0].rows).toHaveLength(1);
  });

  it('does not create a new document for dropping in the same position', () => {
    expect(movePageItem(document(), 'section', 's1', 'page', 1)).toBeNull();
    expect(movePageItem(document(), 'block', 'b2', 'c1', 2)).toBeNull();
  });

});


describe('Page composer positions', () => {
  it('inserts a new section before an existing section', () => {
    const source = document();
    const updated = insertPageItem(source, 'section', 'page', { id: 'new', styles: {}, rows: [] }, 1);
    expect(updated?.sections.map((item) => item.id)).toEqual(['s1', 'new', 's2']);
    expect(source.sections).toHaveLength(2);
  });
  it('inserts a row in the requested section at the requested index', () => {
    const updated = insertPageItem(document(), 'row', 's1', { id: 'r2', styles: {}, layout: '1', columns: [] }, 0);
    expect(updated?.sections[0].rows.map((item) => item.id)).toEqual(['r2', 'r1']);
  });
  it('inserts a block between existing blocks and preserves content', () => {
    const updated = insertPageItem(document(), 'block', 'c1',
      { id: 'middle', type: 'spacer', height: 16, styles: {} }, 1);
    expect(updated?.sections[0].rows[0].columns[0].blocks.map((item) => item.id))
      .toEqual(['b1', 'middle', 'b2']);
  });
  it('rejects misplaced insertions instead of appending', () => {
    const block = { id: 'new', type: 'spacer' as const, height: 16, styles: {} };
    expect(insertPageItem(document(), 'block', 'c1', block, 100)).toBeNull();
    expect(insertPageItem(document(), 'block', 'unknown', block, 0)).toBeNull();
  });
});
