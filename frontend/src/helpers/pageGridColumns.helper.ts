import { RowLayout } from '@shared/content/page-document';
import { PAGE_ROW_LAYOUTS } from '@shared/content/page-layouts';

export function pageGridColumns(layout: RowLayout): string {
  return PAGE_ROW_LAYOUTS[layout].map((weight) => `${weight}fr`).join(' ');
}
