import type { PageDocument, PageStyles } from '@shared/content/page-document';

/** One set of default values for new editor nodes and the public renderer. */
export const PAGE_STYLE_DEFAULTS = {
  background: 'none',
  padding: 0,
  gap: 16,
  radius: 0,
  align: 'left',
} as const satisfies PageStyles;
export const PAGE_DEFAULT_TEXT_COLOR = '#ffffffff';

export type PageBreakpoint = 'desktop' | 'tablet' | 'mobile';

/**
 * Responsive overrides inherit from the nearest ancestor unless this node
 * explicitly defines a text color. A local desktop color overrides a parent's
 * tablet/mobile color; a local tablet color continues through mobile.
 */
export function pageTextColorVars(styles: PageStyles, isPage = false): Record<string, string> {
  const desktop = styles.textColor;
  const tablet = styles.responsive?.tablet?.textColor;
  const mobile = styles.responsive?.mobile?.textColor;
  return {
    '--pc-text-color': desktop ?? (isPage ? PAGE_DEFAULT_TEXT_COLOR : 'inherit'),
    '--pc-tablet-text-color': tablet ?? (
      isPage || desktop ? 'var(--pc-text-color)' : 'inherit'
    ),
    '--pc-mobile-text-color': mobile ?? (
      isPage || desktop || tablet ? 'var(--pc-tablet-text-color)' : 'inherit'
    ),
  };
}

/** The heading's effective color follows the same precedence as the public renderer:
 * page heading theme < nearest node/ancestor color < text-block heading color.
 * Explicit inline Markdown text-color marks remain the final override in HTML.
 */
export function effectiveBlockHeadingColor(
  document: PageDocument,
  blockId: string,
  breakpoint: PageBreakpoint = 'desktop',
): string {
  const colorOn = (styles: PageStyles): string | null => {
    let color = styles.textColor ?? null;
    if (breakpoint !== 'desktop') color = styles.responsive?.tablet?.textColor ?? color;
    if (breakpoint === 'mobile') color = styles.responsive?.mobile?.textColor ?? color;
    return styles.headingColor ?? color;
  };
  const page = colorOn(document.styles) ?? document.theme?.colors?.heading ?? PAGE_DEFAULT_TEXT_COLOR;
  for (const section of document.sections) {
    const sectionColor = colorOn(section.styles) ?? page;
    for (const row of section.rows) {
      const rowColor = colorOn(row.styles) ?? sectionColor;
      for (const column of row.columns) {
        const columnColor = colorOn(column.styles) ?? rowColor;
        const block = column.blocks.find((item) => item.id === blockId);
        if (block) return colorOn(block.styles) ?? columnColor;
      }
    }
  }
  return page;
}

/** The effective picker color follows the same document hierarchy as CSS. */
export function effectiveBlockTextColor(
  document: PageDocument,
  blockId: string,
  breakpoint: PageBreakpoint = 'desktop',
): string {
  const resolve = (styles: PageStyles, inherited: string): string => {
    let color = styles.textColor ?? inherited;
    if (breakpoint !== 'desktop') color = styles.responsive?.tablet?.textColor ?? color;
    if (breakpoint === 'mobile') color = styles.responsive?.mobile?.textColor ?? color;
    return color;
  };
  const pageColor = resolve(document.styles, PAGE_DEFAULT_TEXT_COLOR);
  for (const section of document.sections) {
    const sectionColor = resolve(section.styles, pageColor);
    for (const row of section.rows) {
      const rowColor = resolve(row.styles, sectionColor);
      for (const column of row.columns) {
        const columnColor = resolve(column.styles, rowColor);
        const block = column.blocks.find((item) => item.id === blockId);
        if (block) return resolve(block.styles, columnColor);
      }
    }
  }
  return pageColor;
}
