import type { PageDocument } from '@shared/content/page-document';
import { movePageItem } from './page-editor-operations';

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
});
