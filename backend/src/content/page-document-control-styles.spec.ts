import { describe, expect, it } from 'vitest';
import { validatePageDocument } from './page-document-validation';
const page = (block: Record<string, unknown>) => ({
  id: 'page', schemaVersion: 1, styles: {}, sections: [
    { id: 'section', styles: {}, rows: [
      { id: 'row', styles: {}, layout: '1', columns: [
        { id: 'column', styles: {}, blocks: [block] },
      ] },
    ] },
  ],
});
const button = {
  id: 'button', type: 'button', styles: {}, label: { de: 'Öffnen', en: 'Open' },
  href: '/music', variant: 'primary', size: 'medium',
};
const accordion = {
  id: 'accordion', type: 'accordion', styles: {}, allowMultiple: false,
  items: [{ id: 'entry1', title: { de: 'Frage', en: 'Question' },
    body: { de: '**Antwort**', en: '**Answer**' }, defaultOpen: true }],
};
describe('Composer control appearance validation', () => {
  it('keeps independent button styles without modifying the block surface', () => {
    const result = validatePageDocument(page({ ...button, appearance: {
      backgroundColor: '#e79cc6ff', textColor: '#221121ff', radius: 24,
      paddingX: 18, fontSize: 17, fullWidth: true,
      shadow: { x: 0, y: 8, blur: 22, spread: 0, color: '#12040a99' },
    } }));
    const value = result.sections[0].rows[0].columns[0].blocks[0];
    expect(value.type).toBe('button');
    if (value.type === 'button') expect(value.appearance?.shadow?.blur).toBe(22);
  });
  it('keeps separate header and body colors for each accordion item', () => {
    const result = validatePageDocument(page({ ...accordion, items: [
      { ...accordion.items[0], appearance: {
        headerColor: '#ffffffff', textColor: '#eeeeeeff',
        headerBackgroundColor: '#614061ff', backgroundColor: '#25172aff',
        shadow: { x: 0, y: 3, blur: 12, spread: 0, color: '#00000066' },
      } },
    ] }));
    const value = result.sections[0].rows[0].columns[0].blocks[0];
    if (value.type === 'accordion') expect(value.items[0].appearance?.headerColor).toBe('#ffffffff');
    else throw new Error('Expected accordion');
  });
  it('accepts existing button and accordion blocks without appearance', () => {
    expect(() => validatePageDocument(page(button))).not.toThrow();
    expect(() => validatePageDocument(page(accordion))).not.toThrow();
  });
  it('rejects unknown style properties, injection and excessive shadow values', () => {
    expect(() => validatePageDocument(page({ ...button, appearance: {
      css: 'position:fixed', backgroundColor: '#ffffffff',
    } }))).toThrow();
    expect(() => validatePageDocument(page({ ...button, appearance: {
      backgroundColor: 'url(javascript:evil)',
    } }))).toThrow();
    expect(() => validatePageDocument(page({ ...accordion, items: [
      { ...accordion.items[0], appearance: {
        shadow: { x: 0, y: 200, blur: 0, spread: 0, color: '#ffffffff' },
      } },
    ] }))).toThrow();
  });
});
