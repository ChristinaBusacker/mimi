import { Paragraph } from '@tiptap/extension-paragraph';

export type ParagraphAlignment = 'left' | 'center' | 'right';
// Candy can coexist with each paragraph's existing alignment.
const ALIGNED = /^:::(?:align-(center|right)(-candy)?|candy)\n([\s\S]*?)\n:::(?=\n|$)/;

/** A single paragraph's alignment is stored in Markdown, not on its Composer text block. */
export const MimiAlignedParagraph = Paragraph.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      textAlign: {
        default: 'left',
        parseHTML: (element: HTMLElement) => {
          const value = element.style.textAlign;
          return value === 'center' || value === 'right' ? value : 'left';
        },
        renderHTML: (attributes: Record<string, unknown>) => {
          const value = attributes['textAlign'];
          return value === 'center' || value === 'right' ? { style: `text-align: ${value}` } : {};
        },
      },
      candy: {
        default: false,
        parseHTML: (element: HTMLElement) => element.hasAttribute('data-mimi-candy'),
        renderHTML: (attributes: Record<string, unknown>) =>
          attributes['candy'] === true ? { 'data-mimi-candy': 'true' } : {},
      },
    };
  },
  // Unmarked paragraphs continue through the standard Marked paragraph fallback.
  markdownTokenName: 'mimiAlignedParagraph',
  markdownTokenizer: {
    name: 'mimiAlignedParagraph',
    level: 'block',
    start: (source: string) => source.indexOf(':::'),
    tokenize: (source, _tokens, lexer) => {
      const match = ALIGNED.exec(source);
      if (!match || !match[3].trim() || /\n\s*\n/.test(match[3])) return undefined;
      return {
        type: 'mimiAlignedParagraph',
        raw: match[0],
        alignment: match[1],
        candy: match[2] === '-candy' || match[0].startsWith(':::candy\n'),
        tokens: lexer.inlineTokens(match[3]),
      };
    },
  },
  parseMarkdown: (token, helpers) =>
    helpers.createNode(
      'paragraph',
      {
        textAlign:
          token['alignment'] === 'center' || token['alignment'] === 'right'
            ? token['alignment']
            : 'left',
        candy: token['candy'] === true,
      },
      helpers.parseInline(token.tokens || []),
    ),
  renderMarkdown: (node, helpers, context) => {
    const content = Array.isArray(node.content) ? node.content : [];
    if (!content.length) {
      const last = context?.previousNode;
      return last?.type === 'paragraph' && (!last.content || last.content.length === 0)
        ? '&nbsp;'
        : '';
    }
    const text = helpers.renderChildren(content);
    const alignment = node.attrs?.['textAlign'];
    const candy = node.attrs?.['candy'] === true;
    if (alignment === 'center' || alignment === 'right')
      return `:::align-${alignment}${candy ? '-candy' : ''}\n${text}\n:::`;
    return candy ? `:::candy\n${text}\n:::` : text;
  },
});
