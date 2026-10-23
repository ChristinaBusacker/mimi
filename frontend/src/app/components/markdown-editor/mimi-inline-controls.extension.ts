import { Node } from '@tiptap/core';
import '@tiptap/markdown';
import { mimiInlineHtml, parseMimiInline, readMimiInline, serializeMimiInline, type MimiInlineControl } from '@shared/content/mimi-inline-controls';

/** Editable atomic widgets; Markdown remains portable, typed and HTML-free. */
export const MimiInlineControls = Node.create({
  name: 'mimiInlineControl', group: 'inline', inline: true, atom: true,
  selectable: true, draggable: true, markdownTokenName: 'mimiInlineControl',
  addAttributes() {
    return {
      kind: { default: 'icon' }, name: { default: 'heart' }, size: { default: 24 },
      color: { default: '#ed9fcaff' }, label: { default: '' }, href: { default: '' },
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
    return ({ node }) => {
      const dom = document.createElement('span');
      const widget = node.attrs as MimiInlineControl;
      const spec = serializeMimiInline(widget);
      const value = /^%%mimi-(?:icon|button)\[([^\]]+)\]%%$/.exec(spec)?.[1] ?? '';
      dom.dataset['mimiInline'] = widget.kind;
      dom.dataset['mimiSpec'] = value;
      dom.className = 'markdown-editor__inline-widget';
      dom.contentEditable = 'false';
      dom.innerHTML = mimiInlineHtml(widget);
      // A CTA is editable content here, not a live navigation target.
      dom.querySelector('a')?.removeAttribute('href');
      return { dom };
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
