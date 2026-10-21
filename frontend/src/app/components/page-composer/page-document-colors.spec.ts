import type { PageDocument } from '@shared/content/page-document';
import { collectBookletColors } from './page-document-colors';

describe('Booklet-local color suggestions', () => {
  it('collects only currently used colors, deduplicates and observes changes', () => {
    const doc = {
      styles: { backgroundColor: '#FF00AA', shadow: { x: 0, y: 0, blur: 0, spread: 0, color: '#11223344' } },
      sections: [{ styles: { designBackground: { kind: 'gradient', from: '#ff00aaff', to: '#123456' } },
        rows: [{ styles: {}, columns: [{ styles: {}, blocks: [
          { type: 'albumDetails', styles: {}, palette: { iconColor: '#ABCDEF88' } },
          { type: 'text', styles: { headingColor: '#ff00aa' }, markdown: { de: '%%#765432[Hi]%%', en: '' } },
        ] }] }] }],
    } as unknown as PageDocument;
    expect(collectBookletColors(doc)).toEqual([
      '#ff00aaff', '#11223344', '#123456ff', '#abcdef88', '#765432ff',
    ]);
    doc.sections[0].rows[0].columns[0].blocks.pop();
    expect(collectBookletColors(doc)).not.toContain('#765432ff');
  });
});
