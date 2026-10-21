import { Mark } from '@tiptap/core';
import '@tiptap/markdown';

// Markdown is the canonical storage format. Never store raw HTML or arbitrary CSS.
const COLOR_TOKEN = /^%%#([a-fA-F0-9]{6}(?:[a-fA-F0-9]{2})?)\[([^\]\n]+)\]%%/;
const VALID_COLOR = /^#[a-fA-F0-9]{6}(?:[a-fA-F0-9]{2})?$/;
interface ColorToken { color?: unknown; tokens?: unknown[] }
export const MarkdownTextColor = Mark.create({
  name: 'mimiTextColor',
  addAttributes() {
    return { color: { default: '#ffffff' } };
  },
  parseHTML() { return [{ tag: 'span[data-mimi-text-color]', getAttrs: (element) => {
    const color = element.getAttribute('data-mimi-text-color');
    return color && VALID_COLOR.test(color) ? { color } : false;
  }}]; },
  renderHTML({ HTMLAttributes }) {
    const color = typeof HTMLAttributes['color'] === 'string' && VALID_COLOR.test(HTMLAttributes['color'])
      ? HTMLAttributes['color'] : '#ffffff';
    return ['span', { 'data-mimi-text-color': color, style: `color:${color}` }, 0];
  },
  markdownTokenizer: {
    name: 'mimiTextColor', level: 'inline', start: (source) => source.indexOf('%%#'),
    tokenize: (source, _tokens, lexer) => {
      const match = COLOR_TOKEN.exec(source);
      if (!match) return undefined;
      return { type: 'mimiTextColor', raw: match[0], color: '#' + match[1],
        tokens: lexer.inlineTokens(match[2]) };
    },
  },
  parseMarkdown: (token, helpers) => {
    const data = token as ColorToken;
    const color = typeof data.color === 'string' && VALID_COLOR.test(data.color) ? data.color : '#ffffff';
    return helpers.applyMark('mimiTextColor', helpers.parseInline(token.tokens ?? []), { color });
  },
  renderMarkdown: (node, helpers) => {
    const color = typeof node.attrs?.['color'] === 'string' && VALID_COLOR.test(node.attrs['color'])
      ? node.attrs['color'] : '#ffffff';
    return `%%${color}[${helpers.renderChildren(node.content ?? [])}]%%`;
  },
});
