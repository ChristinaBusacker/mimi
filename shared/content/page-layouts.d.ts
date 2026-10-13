import type { RowLayout } from './page-document';

/** The same allow-list drives editor thumbnails, rendering and server validation. */
export const PAGE_ROW_LAYOUTS = {
  '1': [1],
  '1-1': [1, 1],
  '1-2': [1, 2],
  '2-1': [2, 1],
  '1-3': [1, 3],
  '3-1': [3, 1],
  '1-1-1': [1, 1, 1],
  '1-1-1-1': [1, 1, 1, 1],
  '2-1-1': [2, 1, 1],
  '1-2-1': [1, 2, 1],
  '1-1-2': [1, 1, 2],
} as const satisfies Record<RowLayout, readonly number[]>;

export const PAGE_ROW_OPTIONS = Object.entries(PAGE_ROW_LAYOUTS).map(([id, weights]) => ({
  id: id as RowLayout,
  weights,
  label: weights.map((weight) => `${weight}fr`).join(' '),
}));
