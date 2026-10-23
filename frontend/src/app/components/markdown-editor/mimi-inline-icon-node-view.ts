import { NodeSelection } from '@tiptap/pm/state';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import type { NodeView, EditorView } from '@tiptap/pm/view';
import { MIMI_INLINE_ICON_DEFAULTS, mimiInlineHtml, parseMimiInline } from '@shared/content/mimi-inline-controls';

interface Options {
  node: ProseMirrorNode;
  view: EditorView;
  getPos: () => number | undefined;
}
const clampSize = (value: number): number => Math.max(12, Math.min(128, Math.round(value)));

/** Icon atoms use the same selection-and-drag principle as editable images. */
export function createMimiInlineIconNodeView({ node, view, getPos }: Options): NodeView {
  let current = node;
  let selected = false;
  let dragging: number | null = null;
  let startX = 0;
  let startSize = 24;
  let previewSize = 24;
  const dom = document.createElement('span');
  dom.contentEditable = 'false';
  const graphic = document.createElement('span');
  graphic.className = 'markdown-inline-icon__graphic';
  dom.append(graphic);
  const handle = document.createElement('span');
  handle.className = 'markdown-inline-icon__resize';
  handle.setAttribute('role', 'slider');
  handle.setAttribute('aria-label', 'Icon-Größe ändern');
  handle.setAttribute('aria-valuemin', '12');
  handle.setAttribute('aria-valuemax', '128');
  handle.tabIndex = 0;
  dom.append(handle);

  function readWidget() {
    const attrs = current.attrs;
    const name = typeof attrs['name'] === 'string' ? attrs['name'] : MIMI_INLINE_ICON_DEFAULTS.name;
    const size = typeof attrs['size'] === 'number' ? clampSize(attrs['size']) : MIMI_INLINE_ICON_DEFAULTS.size;
    const color = typeof attrs['color'] === 'string' ? attrs['color'] : MIMI_INLINE_ICON_DEFAULTS.color;
    const parsed = parseMimiInline('icon', `${name}|${size}|${color}`);
    return parsed?.kind === 'icon' ? parsed : { kind: 'icon' as const, ...MIMI_INLINE_ICON_DEFAULTS };
  }
  function paint(): void {
    const widget = readWidget();
    dom.className = 'markdown-editor__inline-widget markdown-inline-icon' +
      (selected ? ' ProseMirror-selectednode' : '');
    dom.dataset['mimiInline'] = 'icon';
    dom.dataset['mimiSpec'] = `${widget.name}|${widget.size}|${widget.color}`;
    graphic.innerHTML = mimiInlineHtml(widget);
    graphic.style.width = `${widget.size}px`;
    handle.setAttribute('aria-valuenow', String(widget.size));
  }
  function select(): void {
    const pos = getPos();
    if (typeof pos !== 'number') return;
    view.dispatch(view.state.tr.setSelection(NodeSelection.create(view.state.doc, pos)));
    view.focus();
  }
  function commitSize(size: number): void {
    const pos = getPos();
    if (typeof pos !== 'number') return;
    const value = clampSize(size);
    if (current.attrs['size'] === value) return;
    const tr = view.state.tr.setNodeMarkup(pos, undefined, { ...current.attrs, size: value });
    tr.setSelection(NodeSelection.create(tr.doc, pos));
    view.dispatch(tr);
  }
  graphic.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    select();
  });
  handle.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 || !event.isPrimary) return;
    event.preventDefault();
    event.stopPropagation();
    select();
    dragging = event.pointerId;
    startX = event.clientX;
    startSize = readWidget().size;
    previewSize = startSize;
    handle.setPointerCapture(event.pointerId);
  });
  handle.addEventListener('pointermove', (event) => {
    if (dragging !== event.pointerId) return;
    previewSize = clampSize(startSize + event.clientX - startX);
    graphic.style.width = `${previewSize}px`;
    const svg = graphic.querySelector('svg');
    if (svg) { svg.setAttribute('width', String(previewSize)); svg.setAttribute('height', String(previewSize)); }
    handle.setAttribute('aria-valuenow', String(previewSize));
  });
  handle.addEventListener('pointerup', (event) => {
    if (dragging !== event.pointerId) return;
    dragging = null;
    if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
    commitSize(previewSize);
    paint();
  });
  handle.addEventListener('pointercancel', (event) => {
    if (dragging !== event.pointerId) return;
    dragging = null;
    paint();
  });
  handle.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    event.stopPropagation();
    commitSize(readWidget().size + (event.key === 'ArrowRight' ? 1 : -1) * (event.shiftKey ? 10 : 1));
  });
  paint();
  return {
    dom,
    update(next) {
      if (next.type !== current.type || next.attrs['kind'] !== 'icon') return false;
      current = next;
      paint();
      return true;
    },
    selectNode() { selected = true; paint(); },
    deselectNode() { selected = false; paint(); },
    stopEvent(event) {
      if (!(event.target instanceof Element)) return false;
      return !!event.target.closest('.markdown-inline-icon__resize') ||
        (event.type === 'mousedown' && !!event.target.closest('.markdown-inline-icon__graphic'));
    },
    ignoreMutation() { return true; },
  };
}
