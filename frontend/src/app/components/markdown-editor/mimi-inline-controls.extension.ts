import { Node } from '@tiptap/core';
import { createMimiInlineIconNodeView } from './mimi-inline-icon-node-view';
import '@tiptap/markdown';
import { MIMI_INLINE_ICON_DEFAULTS, mimiInlineHtml, parseMimiInline, readMimiInline, serializeMimiInline, type MimiInlineControl } from '@shared/content/mimi-inline-controls';

/** Editable atomic widgets; Markdown remains portable, typed and HTML-free. */
export const MimiInlineControls = Node.create({
  name: 'mimiInlineControl', group: 'inline', inline: true, atom: true,
  selectable: true, draggable: true, markdownTokenName: 'mimiInlineControl',
  addAttributes() {
    return {
      kind: { default: 'icon' }, name: { default: MIMI_INLINE_ICON_DEFAULTS.name }, size: { default: MIMI_INLINE_ICON_DEFAULTS.size },
      color: { default: MIMI_INLINE_ICON_DEFAULTS.color }, label: { default: '' }, href: { default: '' },
      variant: { default: 'primary' },
    };
  },
  parseHTML() {
    return [{ tag: 'span[data-mimi-inline]', getAttrs: (element) => {
      const kind = element.getAttribute('data-mimi-inline') ?? '';
      const value = element.getAttribute('data-mimi-spec') ?? '';
      const widget = parseMimiInline(kind, value);
      return widget ? widget : false;
    } }];
  },
  renderHTML({ node }) {
    const widget = node.attrs as MimiInlineControl;
    const spec = serializeMimiInline(widget);
    const value = /^%%mimi-(?:icon|button)\[([^\]]+)\]%%$/.exec(spec)?.[1] ?? '';
    return ['span', {
      'data-mimi-inline': widget.kind, 'data-mimi-spec': value,
      class: 'markdown-editor__inline-widget',
    }, widget.kind === 'icon' ? `✦ ${widget.name}` : widget.label];
  },
  addNodeView() {
    return ({ node, view, getPos }) => {
      if (node.attrs['kind'] === 'icon') {
        return createMimiInlineIconNodeView({ node, view, getPos });
      }
      const dom = document.createElement('span');
      let current = node;
      const paint = () => {
        const widget = current.attrs as MimiInlineControl;
        const spec = serializeMimiInline(widget);
        const value = /^%%mimi-(?:icon|button)\[([^\]]+)\]%%$/.exec(spec)?.[1] ?? '';
        dom.dataset['mimiInline'] = widget.kind;
        dom.dataset['mimiSpec'] = value;
        dom.className = 'markdown-editor__inline-widget';
        dom.contentEditable = 'false';
        dom.innerHTML = mimiInlineHtml(widget);
        // Navigation must never occur inside the editor.
        dom.querySelector('a')?.removeAttribute('href');
      };
      paint();
      return {
        dom,
        update(next) {
          if (next.type !== current.type || next.attrs['kind'] !== current.attrs['kind']) return false;
          current = next;
          paint();
          return true;
        },
      };
    };
  },
  markdownTokenizer: {
    name: 'mimiInlineControl', level: 'inline',
    start: (source) => source.indexOf('%%mimi-'),
    tokenize: (source) => {
      const found = readMimiInline(source);
      return found ? { type: 'mimiInlineControl', raw: found.raw, widget: found.widget } : undefined;
    },
  },
  parseMarkdown: (token) => {
    const value = token as { widget?: MimiInlineControl; raw?: string };
    const widget = value.widget ?? (value.raw ? readMimiInline(value.raw)?.widget : undefined);
    return widget ? { type: 'mimiInlineControl', attrs: widget } : [];
  },
  renderMarkdown: (node) => {
    const widget = node.attrs as MimiInlineControl;
    return serializeMimiInline(widget);
  },
});
