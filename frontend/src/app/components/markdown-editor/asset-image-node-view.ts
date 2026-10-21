import { NodeSelection } from '@tiptap/pm/state';
import type { NodeView } from '@tiptap/pm/view';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import type { EditorView } from '@tiptap/pm/view';

type ImageMode = 'inline' | 'block' | 'wrap' | null;
interface ImageNodeViewOptions {
  node: ProseMirrorNode;
  view: EditorView;
  getPos: () => number | undefined;
}

const validMode = (value: unknown): ImageMode =>
  value === 'inline' || value === 'block' || value === 'wrap' ? value : null;
const validWidth = (value: unknown): number | null =>
  typeof value === 'number' && Number.isInteger(value) && value >= 10 && value <= 100
    ? value : null;

/** An atomic image node. Handles preview locally; only pointerup changes the document. */
export function createAssetImageNodeView({ node, view, getPos }: ImageNodeViewOptions): NodeView {
  let current = node;
  let selected = false;
  const dom = document.createElement('span');
  const image = document.createElement('img');
  image.draggable = false;
  image.loading = 'lazy';
  dom.append(image);

  const handles = (['nw', 'ne', 'sw', 'se'] as const).map((corner) => {
    const handle = document.createElement('span');
    handle.className = `markdown-image__handle markdown-image__handle--${corner}`;
    handle.setAttribute('role', 'slider');
    handle.setAttribute('aria-label', `Bildbreite ändern (${corner})`);
    handle.setAttribute('aria-valuemin', '10');
    handle.setAttribute('aria-valuemax', '100');
    handle.tabIndex = 0;
    dom.append(handle);
    return { corner, handle };
  });

  function paint(): void {
    const attrs = current.attrs;
    const mode = validMode(attrs['displayMode']);
    const align = attrs['alignment'] === 'left' || attrs['alignment'] === 'right'
      ? attrs['alignment'] : 'center';
    const size = typeof attrs['size'] === 'string' &&
      ['small', 'medium', 'large', 'full'].includes(attrs['size'])
      ? attrs['size'] : 'large';
    dom.className = `markdown-image content-media media-${align} size-${size}` +
      (mode ? ` media-mode-${mode}` : ' media-mode-legacy') +
      (selected ? ' ProseMirror-selectednode' : '');
    const asset = String(attrs['assetId'] ?? '');
    image.src = /^[\da-f-]{36}$/i.test(asset) ? `/api/assets/${asset}` : '';
    image.alt = typeof attrs['alt'] === 'string' ? attrs['alt'] : '';
    image.style.width = '100%';
    const width = validWidth(attrs['widthPercent']);
    dom.style.width = width === null ? '' : `${width}%`;
    dom.dataset['displayMode'] = mode ?? 'legacy';
    for (const { handle } of handles) {
      handle.setAttribute('aria-valuenow', String(width ?? 100));
    }
  }

  function select(): void {
    const pos = getPos();
    if (typeof pos !== 'number') return;
    view.dispatch(view.state.tr.setSelection(NodeSelection.create(view.state.doc, pos)));
    view.focus();
  }

  function commitWidth(width: number): void {
    const pos = getPos();
    if (typeof pos !== 'number') return;
    const next = Math.max(10, Math.min(100, Math.round(width)));
    if (validWidth(current.attrs['widthPercent']) === next) return;
    const transaction = view.state.tr.setNodeMarkup(pos, undefined, {
      ...current.attrs, widthPercent: next,
    });
    transaction.setSelection(NodeSelection.create(transaction.doc, pos));
    view.dispatch(transaction);
  }

  image.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    select();
  });

  for (const { corner, handle } of handles) {
    let pointerId: number | null = null;
    let startX = 0;
    let startWidth = 100;
    let containerWidth = 1;
    let preview = 100;
    handle.addEventListener('pointerdown', (event) => {
      if (event.button !== 0 || !event.isPrimary) return;
      event.preventDefault();
      event.stopPropagation();
      select();
      pointerId = event.pointerId;
      startX = event.clientX;
      // Use the containing text column, not the image, as the percentage denominator.
      containerWidth = Math.max(1, dom.parentElement?.getBoundingClientRect().width ?? 1);
      startWidth = validWidth(current.attrs['widthPercent']) ??
        Math.max(10, Math.min(100, Math.round(dom.getBoundingClientRect().width / containerWidth * 100)));
      preview = startWidth;
      handle.setPointerCapture(event.pointerId);
    });
    handle.addEventListener('pointermove', (event) => {
      if (pointerId !== event.pointerId) return;
      const direction = corner.endsWith('e') ? 1 : -1;
      preview = Math.max(10, Math.min(100, Math.round(
        startWidth + direction * (event.clientX - startX) / containerWidth * 100,
      )));
      dom.style.width = `${preview}%`;
      handle.setAttribute('aria-valuenow', String(preview));
    });
    const finish = (event: PointerEvent): void => {
      if (pointerId !== event.pointerId) return;
      pointerId = null;
      if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
      commitWidth(preview);
      // The next render restores the persisted width even if it was unchanged.
      paint();
    };
    handle.addEventListener('pointerup', finish);
    handle.addEventListener('pointercancel', (event) => {
      if (pointerId !== event.pointerId) return;
      pointerId = null;
      paint();
    });
    handle.addEventListener('keydown', (event) => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      event.preventDefault();
      event.stopPropagation();
      const base = validWidth(current.attrs['widthPercent']) ?? 100;
      commitWidth(base + (event.key === 'ArrowRight' ? 1 : -1) * (event.shiftKey ? 10 : 1));
    });
  }

  paint();
  return {
    dom,
    update(next) {
      if (next.type !== current.type) return false;
      current = next;
      paint();
      return true;
    },
    selectNode() { selected = true; paint(); },
    deselectNode() { selected = false; paint(); },
    stopEvent(event) {
      if (!(event.target instanceof Element)) return false;
      // The image pointerdown handler selects this node explicitly. Do not
      // let ProseMirror's later mousedown handling move the selection again.
      return !!event.target.closest('.markdown-image__handle') ||
        (event.type === 'mousedown' && event.target === image);
    },
    ignoreMutation() { return true; },
  };
}
