import type {
  PageDocument,
  PageLocale,
  PageStyles,
  PageStyleValues,
  RowLayout,
} from '@shared/content/page-document';

import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { NgStyle } from '@angular/common';
import MarkdownIt from 'markdown-it';
import { pageGridColumns } from '../../../helpers/pageGridColumns.helper';

const markdown = new MarkdownIt({ html: false, linkify: false, breaks: false });
const ASSET = /^asset:([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i;
markdown.renderer.rules['image'] = (tokens, index): string => {
  const token = tokens[index];
  const match = ASSET.exec(token.attrGet('src')?.toString() ?? '');
  if (!match) return '';
  return `<img src="/api/assets/${match[1]}/image/large/fallback" alt="${markdown.utils.escapeHtml(token.content)}" loading="lazy">`;
};

/** Browser/SSR shared presentation. Angular sanitizes markdown output at innerHTML. */
@Component({
  selector: 'app-page-renderer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgStyle],
  templateUrl: './page-renderer.html',
  styleUrl: './page-renderer.scss',
})
export class PageRenderer {
  readonly document = input.required<PageDocument>();
  readonly locale = input.required<PageLocale>();

  protected styleVars(styles: PageStyles): Record<string, string> {
    const result: Record<string, string> = {};
    const bg = (value: PageStyleValues): string => {
      if (value.backgroundColor) return value.backgroundColor;
      switch (value.background) {
        case 'glass': return 'rgb(24 16 34 / 52%)';
        case 'solid': return '#282034';
        case 'accent': return 'rgb(218 139 185 / 16%)';
        default: return 'transparent';
      }
    };
    const base: PageStyleValues = {
      background: styles.background ?? 'none',
      backgroundColor: styles.backgroundColor,
      textColor: styles.textColor,
      padding: styles.padding ?? 0,
      gap: styles.gap ?? 16,
      radius: styles.radius ?? 0,
      align: styles.align ?? 'left',
    };
    const keys = ['padding', 'gap', 'radius', 'align', 'text-color', 'background-color'] as const;
    const css = (values: PageStyleValues, key: typeof keys[number]): string | undefined => {
      switch (key) {
        case 'padding': return values.padding === undefined ? undefined : `${values.padding}px`;
        case 'gap': return values.gap === undefined ? undefined : `${values.gap}px`;
        case 'radius': return values.radius === undefined ? undefined : `${values.radius}px`;
        case 'align': return values.align;
        case 'text-color': return values.textColor;
        case 'background-color': return values.background !== undefined || values.backgroundColor
          ? bg(values) : undefined;
      }
    };
    for (const key of keys) {
      result[`--pc-${key}`] = css(base, key) ?? 'inherit';
      result[`--pc-tablet-${key}`] = css(styles.responsive?.tablet ?? {}, key) ?? `var(--pc-${key})`;
      result[`--pc-mobile-${key}`] = css(styles.responsive?.mobile ?? {}, key) ?? `var(--pc-tablet-${key})`;
    }
    return result;
  }

  protected grid(layout: RowLayout): string {
    return pageGridColumns(layout);
  }
  protected surface(styles: PageStyles): string {
    return `page-surface--${styles.background ?? 'none'}`;
  }
  protected html(content: string): string {
    return markdown.render(content);
  }
  protected image(assetId: string): string {
    return `/api/assets/${encodeURIComponent(assetId)}/image/large/fallback`;
  }
}
