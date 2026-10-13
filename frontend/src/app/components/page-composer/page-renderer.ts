import type {
  PageDocument,
  PageLocale,
  PageStyles,
  RowLayout,
} from '@shared/content/page-document';

import { ChangeDetectionStrategy, Component, input } from '@angular/core';
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
  templateUrl: './page-renderer.html',
  styleUrl: './page-renderer.scss',
})
export class PageRenderer {
  readonly document = input.required<PageDocument>();
  readonly locale = input.required<PageLocale>();

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
