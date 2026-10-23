import { describe, expect, it } from 'vitest';
import { installMimiInlineControls, mimiInlineHtml, parseMimiInline, readMimiInline, serializeMimiInline } from './mimi-inline-controls';
import MarkdownIt from 'markdown-it';
describe('Mimi inline widgets', () => {
  it('round trips a German CTA without losing encoded characters', () => {
    const button = { kind: 'button' as const, label: 'Mehr erfahren & helfen', href: '/unterstuetzen?a=1&b=2', variant: 'primary' as const };
    expect(readMimiInline(serializeMimiInline(button))?.widget).toEqual(button);
  });
  it('rejects unsafe schemes, malformed encoding and unknown SVG paths', () => {
    expect(parseMimiInline('button', 'Hallo|javascript%3Aalert(1)|primary')).toBeNull();
    expect(parseMimiInline('button', '%E0%A4%A|%2Fabout|primary')).toBeNull();
    expect(parseMimiInline('icon', 'script|32|#ffffffff')).toBeNull();
  });
  it('round-trips resized icons and rejects values outside the drag range', () => {
    for (const size of [12, 24, 63, 96, 128]) {
      const icon = { kind: 'icon' as const, name: 'heart', size, color: '#ed9fcaff' };
      expect(readMimiInline(serializeMimiInline(icon))?.widget).toEqual(icon);
    }
    expect(parseMimiInline('icon', 'heart|129|#ed9fcaff')).toBeNull();
    expect(parseMimiInline('icon', 'heart|11|#ed9fcaff')).toBeNull();
  });
  it('renders safe SVG and anchor without converting strings to HTML', () => {
    const md = new MarkdownIt({ html: false }); installMimiInlineControls(md);
    const html = md.render(`Hi ${serializeMimiInline({ kind: 'icon', name: 'heart', size: 24, color: '#ed9fcaff' })} ${serializeMimiInline({ kind: 'button', label: 'Mimi & Musik', href: '/music', variant: 'outline' })}`);
    expect(html).toContain('<svg');
    expect(html).toContain('href="/music"');
    expect(html).toContain('Mimi &amp; Musik');
    expect(html).not.toContain('javascript:');
    expect(mimiInlineHtml({ kind: 'icon', name: 'heart', size: 24, color: '#ed9fcaff' })).toContain('<path');
  });
});
