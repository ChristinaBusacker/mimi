import { Mark } from '@tiptap/core';
import '@tiptap/markdown';

/** A bounded inline scale relative to the surrounding paragraph or heading size. */
export const MIMI_FONT_SIZE_STEPS = [75, 85, 100, 115, 130, 150, 175, 200, 250, 300] as const;
type MimiFontSize = typeof MIMI_FONT_SIZE_STEPS[number];
const FONT_SIZE_TOKEN = /^%%size-(75|85|100|115|130|150|175|200|250|300)\[([^\]\n]+)\]%%/;
const VALID_FONT_SIZE = /^(?:75|85|100|115|130|150|175|200|250|300)$/;
const validSize = (value: unknown): value is MimiFontSize =>
  typeof value === 'number' && MIMI_FONT_SIZE_STEPS.some((step) => step === value);

export function nextMimiFontSize(current: number, direction: 'larger' | 'smaller'): MimiFontSize {
  const index = MIMI_FONT_SIZE_STEPS.findIndex((step) => step >= current);
  const currentIndex = index < 0 ? MIMI_FONT_SIZE_STEPS.length - 1 : index;
  const targetIndex = direction === 'larger'
    ? Math.min(MIMI_FONT_SIZE_STEPS.length - 1, currentIndex + 1)
    : Math.max(0, currentIndex - 1);
  return MIMI_FONT_SIZE_STEPS[targetIndex];
}

interface SizeToken { percent?: unknown; tokens?: unknown[] }
export const MarkdownFontSize = Mark.create({
  name: 'mimiFontSize',
  addAttributes() { return { percent: { default: 100 } }; },
  parseHTML() { return [{ tag: 'span[data-mimi-font-size]', getAttrs: (element: HTMLElement) => {
    const percent = Number(element.getAttribute('data-mimi-font-size'));
    return validSize(percent) ? { percent } : false;
  } }]; },
  renderHTML({ HTMLAttributes }) {
    const percent = validSize(HTMLAttributes['percent']) ? HTMLAttributes['percent'] : 100;
    return ['span', { 'data-mimi-font-size': String(percent), style: `font-size:${percent}%` }, 0];
  },
  markdownTokenizer: {
    name: 'mimiFontSize', level: 'inline', start: (source: string) => source.indexOf('%%size-'),
    tokenize: (source, _tokens, lexer) => {
      const match = FONT_SIZE_TOKEN.exec(source);
      if (!match) return undefined;
      return { type: 'mimiFontSize', raw: match[0], percent: Number(match[1]),
        tokens: lexer.inlineTokens(match[2]) };
    },
  },
  parseMarkdown: (token, helpers) => {
    const data = token as SizeToken;
    const percent = validSize(data.percent) ? data.percent : 100;
    return helpers.applyMark('mimiFontSize', helpers.parseInline(token.tokens ?? []), { percent });
  },
  renderMarkdown: (node, helpers) => {
    const percent = validSize(node.attrs?.['percent']) ? node.attrs['percent'] : 100;
    return `%%size-${percent}[${helpers.renderChildren(node.content ?? [])}]%%`;
  },
});
