import type { PageBlock, PageDocument, PageRow, PageSection } from '@shared/content/page-document';

export type MoveKind = 'section' | 'row' | 'block';

/** Move content between siblings/columns without losing IDs or nested data. */
export function movePageItem(
  document: PageDocument,
  kind: MoveKind,
  id: string,
  destinationId: string,
  position: number,
): PageDocument | null {
  const next = structuredClone(document);
  const lists: Array<{ parent: string; children: Array<PageSection | PageRow | PageBlock> }> = [];
  if (kind === 'section') {
    lists.push({ parent: next.id, children: next.sections });
  } else {
    for (const section of next.sections) {
      if (kind === 'row') {
        lists.push({ parent: section.id, children: section.rows });
      } else {
        for (const row of section.rows) {
          for (const column of row.columns) {
            lists.push({ parent: column.id, children: column.blocks });
          }
        }
      }
    }
  }
  const source = lists.find(({ children }) => children.some((item) => item.id === id));
  const destination = lists.find(({ parent }) => parent === destinationId);
  if (!source || !destination || !Number.isInteger(position) || position < 0 || position > destination.children.length) {
    return null;
  }
  if (source !== destination && destination.children.length >= (kind === 'section' ? 30 : kind === 'row' ? 30 : 36)) {
    return null;
  }
  const sourceIndex = source.children.findIndex((item) => item.id === id);
  const insertAt = source === destination && sourceIndex < position ? position - 1 : position;
  if (source === destination && sourceIndex === insertAt) return null;
  const [item] = source.children.splice(sourceIndex, 1);
  destination.children.splice(insertAt, 0, item);
  return next;
}
