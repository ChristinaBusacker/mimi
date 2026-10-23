import type { PageDocument } from '@shared/content/page-document';
import {
  PAGE_DEFAULT_TEXT_COLOR,
  PAGE_STYLE_DEFAULTS,
  effectiveBlockTextColor,
  pageTextColorVars,
} from './page-style-defaults';

const document: PageDocument = {
  id: 'page', schemaVersion: 1, styles: {},
  sections: [{
    id: 'section', styles: {}, rows: [{
      id: 'row', layout: '1', styles: {}, columns: [{
        id: 'column', styles: {}, blocks: [{
          id: 'text', type: 'text', styles: {}, markdown: { de: 'Text', en: 'Text' },
        }],
      }],
    }],
  }],
};

const section = document.sections[0];
const column = section.rows[0].columns[0];
const text = column.blocks[0];

describe('Page Composer defaults and text color inheritance', () => {
  beforeEach(() => {
    document.styles = {};
    section.styles = {};
    section.rows[0].styles = {};
    column.styles = {};
    text.styles = {};
  });

  it('uses the same unstyled white fallback as the color picker', () => {
    expect(PAGE_STYLE_DEFAULTS).toEqual({
      background: 'none', padding: 0, gap: 16, radius: 0, align: 'left',
    });
    expect(effectiveBlockTextColor(document, 'text')).toBe(PAGE_DEFAULT_TEXT_COLOR);
    expect(pageTextColorVars(document.styles, true)['--pc-text-color'])
      .toBe(PAGE_DEFAULT_TEXT_COLOR);
  });

  it('resolves explicit page, section and block colors without modifying stored values', () => {
    document.styles.textColor = '#aa0000ff';
    expect(effectiveBlockTextColor(document, 'text')).toBe('#aa0000ff');
    section.styles.textColor = '#00bb00ff';
    expect(effectiveBlockTextColor(document, 'text')).toBe('#00bb00ff');
    text.styles.textColor = '#0000ccff';
    expect(effectiveBlockTextColor(document, 'text')).toBe('#0000ccff');
  });

  it('inherits responsive parent colors unless a child overrides them', () => {
    section.styles.responsive = {
      tablet: { textColor: '#220000ff' }, mobile: { textColor: '#330000ff' },
    };
    expect(effectiveBlockTextColor(document, 'text', 'desktop')).toBe(PAGE_DEFAULT_TEXT_COLOR);
    expect(effectiveBlockTextColor(document, 'text', 'tablet')).toBe('#220000ff');
    expect(effectiveBlockTextColor(document, 'text', 'mobile')).toBe('#330000ff');
    expect(pageTextColorVars(text.styles)).toEqual({
      '--pc-text-color': 'inherit',
      '--pc-tablet-text-color': 'inherit',
      '--pc-mobile-text-color': 'inherit',
    });
    text.styles.textColor = '#123456ff';
    expect(effectiveBlockTextColor(document, 'text', 'mobile')).toBe('#123456ff');
    expect(pageTextColorVars(text.styles)['--pc-mobile-text-color'])
      .toBe('var(--pc-tablet-text-color)');
    text.styles.responsive = { mobile: { textColor: '#abcdefaa' } };
    expect(effectiveBlockTextColor(document, 'text', 'mobile')).toBe('#abcdefaa');
    expect(effectiveBlockTextColor(document, 'text', 'tablet')).toBe('#123456ff');
  });

  it('keeps tablet overrides active on mobile until a mobile value is supplied', () => {
    text.styles.responsive = { tablet: { textColor: '#ff00ffff' } };
    expect(effectiveBlockTextColor(document, 'text', 'mobile')).toBe('#ff00ffff');
    expect(pageTextColorVars(text.styles)['--pc-mobile-text-color'])
      .toBe('var(--pc-tablet-text-color)');
  });
});
