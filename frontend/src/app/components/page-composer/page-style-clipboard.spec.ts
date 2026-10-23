import type { PageBlock, PageColumn, PageRow, PageSection } from '@shared/content/page-document';
import { applyComposerStyle, copyComposerStyle } from './page-style-clipboard';

const section = (id: string, styles: PageSection['styles']): PageSection => ({ id, styles, rows: [] });
const row = (id: string, styles: PageRow['styles']): PageRow => ({ id, styles, layout: '1', columns: [] });
const column = (id: string, styles: PageColumn['styles']): PageColumn => ({ id, styles, blocks: [] });

describe('Composer style clipboard', () => {
  it('copies a deep snapshot and replaces all responsive styles of the same structural kind', () => {
    const source = section('first', {
      background: 'none', padding: 12, textColor: '#ffffff',
      responsive: { tablet: { padding: 5 }, mobile: { padding: 2 } },
      designBackground: { kind: 'gradient', from: '#333333', to: '#111111', angle: 90 },
    });
    const copied = copyComposerStyle('section', source, 2);
    source.styles.responsive!.mobile!.padding = 25;
    const destination = section('second', { radius: 9, responsive: { mobile: { gap: 44 } } });
    applyComposerStyle('section', destination, copied);
    expect(destination.id).toBe('second');
    expect(destination.styles).toEqual(copied.styles);
    expect(destination.styles.responsive?.mobile?.padding).toBe(2);
    destination.styles.responsive!.mobile!.padding = 18;
    expect(copied.styles.responsive?.mobile?.padding).toBe(2);
  });

  it('transfers only shared properties across kinds without destroying local-specific styling or layout', () => {
    const source = section('s', { background: 'glass', textColor: '#fefefe', shadow: {
      x: 0, y: 2, blur: 8, spread: 0, color: '#111111',
    }, designBackground: { kind: 'color', color: '#555555' } });
    const target = row('r', { radius: 17, spacing: 'standard', responsive: { mobile: { gap: 8 } } });
    applyComposerStyle('row', target, copyComposerStyle('section', source));
    expect(target.id).toBe('r');
    expect(target.styles.textColor).toBe('#fefefe');
    expect(target.styles.radius).toBeUndefined();
    expect(target.styles.spacing).toBe('standard');
    expect(target.styles.responsive).toBeUndefined();
    expect(target.styles.designBackground).toEqual(source.styles.designBackground);
  });

  it('never changes content, URL or node IDs when copying buttons', () => {
    const from: PageBlock = { id: 'from', type: 'button', label: { de: 'Alt', en: 'Old' },
      href: 'https://one.example', variant: 'primary', size: 'medium',
      styles: { textColor: '#ffffff' }, appearance: { radius: 13, backgroundColor: '#221144' } };
    const to: PageBlock = { id: 'to', type: 'button', label: { de: 'Neu', en: 'New' },
      href: '/about', variant: 'secondary', size: 'large',
      styles: { gap: 18 }, appearance: { radius: 1 } };
    const copied = copyComposerStyle('block', from);
    applyComposerStyle('block', to, copied);
    expect(to.id).toBe('to');
    expect(to.label.de).toBe('Neu');
    expect(to.href).toBe('/about');
    expect(to.variant).toBe('secondary');
    expect(to.appearance).toEqual({ radius: 13, backgroundColor: '#221144' });
    to.appearance!.radius = 55;
    expect(copied.appearance?.radius).toBe(13);
  });

  it('copies only common styles between unrelated block kinds', () => {
    const from: PageBlock = { id: 'a', type: 'button', label: { de: '', en: '' }, href: '/a',
      variant: 'primary', size: 'small', styles: { textColor: '#ffccdd', headingColor: '#00ff00' },
      appearance: { radius: 25 } };
    const target: PageBlock = { id: 'b', type: 'text', markdown: { de: 'Hallo', en: 'Hello' },
      styles: { headingColor: '#ffffff', textShadow: 'strong' } };
    applyComposerStyle('block', target, copyComposerStyle('block', from));
    expect(target.styles.textColor).toBe('#ffccdd');
    expect(target.styles.headingColor).toBe('#ffffff');
    expect(target.styles.textShadow).toBe('strong');
    expect(target.markdown.de).toBe('Hallo');
  });

  it('preserves accordion items and only copies appearance-specific album palette on matching widgets', () => {
    const accordion: PageBlock = { id: 'a', type: 'accordion', styles: {}, items: [
      { id: 'i', title: { de: 'Frage', en: 'Question' }, body: { de: 'Text', en: 'Text' },
        appearance: { radius: 22 } },
    ] };
    const other: PageBlock = { id: 'x', type: 'accordion', styles: {}, items: [
      { id: 'j', title: { de: 'Andere', en: 'Other' }, body: { de: 'Antwort', en: 'Answer' } },
    ] };
    applyComposerStyle('block', other, copyComposerStyle('block', accordion));
    expect(other.items[0].id).toBe('j');
    expect(other.items[0].appearance).toBeUndefined();
    const album: PageBlock = { id: 'album1', type: 'albumTracks', styles: {}, palette: { iconColor: '#f58bbb' } };
    const otherAlbum: PageBlock = { id: 'album2', type: 'albumTracks', styles: {}, palette: { textColor: '#000000' } };
    applyComposerStyle('block', otherAlbum, copyComposerStyle('block', album));
    expect(otherAlbum.palette).toEqual({ iconColor: '#f58bbb' });
  });

  it('transfers column content alignment without replacing the blocks', () => {
    const source = column('one', { gap: 8 });
    source.contentAlign = 'center';
    const target = column('two', { gap: 32 });
    target.contentAlign = 'end';
    target.blocks = [{ id: 'body', type: 'text', styles: {}, markdown: { de: 'Text', en: 'Copy' } }];
    applyComposerStyle('column', target, copyComposerStyle('column', source));
    expect(target.contentAlign).toBe('center');
    expect(target.blocks).toHaveLength(1);
    expect(target.blocks[0].id).toBe('body');
  });

  it('copies icon size but not its icon identity', () => {
    const from: PageBlock = { id: 'one', type: 'icon', name: 'heart', size: 56,
      ariaLabel: { de: 'Liebe', en: 'Love' }, styles: { textColor: '#ffffff' } };
    const to: PageBlock = { id: 'two', type: 'icon', name: 'star', size: 20,
      ariaLabel: { de: 'Stern', en: 'Star' }, styles: {} };
    applyComposerStyle('block', to, copyComposerStyle('block', from));
    expect(to.size).toBe(56);
    expect(to.name).toBe('star');
    expect(to.ariaLabel.de).toBe('Stern');
  });

  it('keeps container content and IDs when a layout style is copied to a column', () => {
    const to = column('col', { padding: 20, spacing: 'large' });
    applyComposerStyle('column', to, copyComposerStyle('section', section('section', { textColor: '#aaaabb' })));
    expect(to.id).toBe('col');
    expect(to.styles.spacing).toBe('large');
    expect(to.styles.padding).toBeUndefined();
    expect(to.styles.textColor).toBe('#aaaabb');
  });
});
