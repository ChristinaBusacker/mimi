import { describe, expect, it } from 'vitest';
import { validatePageDocument } from './page-document-validation';

const styles = { background: 'none', gap: 16, padding: 0, radius: 0, align: 'left' };
function documentWith(block: Record<string, unknown>) {
  return { id: 'page', schemaVersion: 1, styles, sections: [
    { id: 'section', styles, rows: [{ id: 'row', styles, layout: '1', columns: [
      { id: 'column', styles, blocks: [{ ...block, id: 'block', styles }] },
    ] }] },
  ] };
}
const localized = { de: 'Hallo', en: 'Hello' };
describe('Composer interactive blocks', () => {
  it('accepts localized button links, sizes and icons', () => {
    const result = validatePageDocument(documentWith({ type: 'button', label: localized,
      href: '/music', variant: 'primary', size: 'medium', icon: 'heart' }));
    expect(result.sections[0].rows[0].columns[0].blocks[0].type).toBe('button');
  });
  it('refuses javascript links and unknown icons', () => {
    for (const href of ['javascript:alert(1)', '//example.org', 'http://example.org'])
      expect(() => validatePageDocument(documentWith({ type: 'button', label: localized,
        href, variant: 'outline', size: 'small' }))).toThrow();
    expect(() => validatePageDocument(documentWith({ type: 'icon', name: 'not-a-real-icon',
      size: 32, ariaLabel: localized }))).toThrow();
  });
  it('validates accordion entry IDs, nesting and defaults', () => {
    const item = { id: 'a', title: localized, body: localized, defaultOpen: true };
    expect(validatePageDocument(documentWith({ type: 'accordion', items: [item] })).sections).toHaveLength(1);
    expect(() => validatePageDocument(documentWith({ type: 'accordion', items: [item, { ...item, id: 'b' }] }))).toThrow();
    expect(() => validatePageDocument(documentWith({ type: 'accordion', items: [item, { ...item, defaultOpen: false }] }))).toThrow();
  });
});
