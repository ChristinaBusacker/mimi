import type { PageDocument, PageStyles, PageStyleValues, PageBlock } from '@shared/content/page-document';

/** Only colors referenced by the current saved/draft booklet. No persistent history. */
export function collectBookletColors(document: PageDocument): string[] {
  const colors = new Set<string>();
  const add = (value: unknown): void => {
    if (typeof value !== 'string' || !/^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/i.test(value)) return;
    colors.add((value.length === 7 ? `${value}ff` : value).toLowerCase());
  };
  const values = (style: PageStyleValues | undefined): void => {
    add(style?.backgroundColor);
    add(style?.textColor);
  };
  const styles = (style: PageStyles): void => {
    values(style);
    values(style.responsive?.tablet);
    values(style.responsive?.mobile);
    add(style.headingColor);
    add(style.border?.color);
    add(style.shadow?.color);
    const background = style.designBackground;
    if (background?.kind === 'color') add(background.color);
    if (background?.kind === 'gradient') {
      add(background.from);
      add(background.to);
    }
  };
  const blockColors = (block: PageBlock): void => {
    styles(block.styles);
    if (block.type === 'albumDetails' || block.type === 'albumTracks' || block.type === 'albumCredits') {
      const palette = block.palette;
      if (palette) for (const color of Object.values(palette)) add(color);
    }
    if (block.type === 'text') {
      for (const locale of ['de', 'en'] as const) {
        for (const match of block.markdown[locale].matchAll(/%%#([0-9a-f]{6}(?:[0-9a-f]{2})?)\[/gi)) {
          add(`#${match[1]}`);
        }
      }
    }
  };
  styles(document.styles);
  for (const section of document.sections) {
    styles(section.styles);
    for (const row of section.rows) {
      styles(row.styles);
      for (const column of row.columns) {
        styles(column.styles);
        for (const block of column.blocks) blockColors(block);
      }
    }
  }
  return [...colors];
}
