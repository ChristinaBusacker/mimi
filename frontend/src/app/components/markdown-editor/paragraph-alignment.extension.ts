import { Paragraph } from '@tiptap/extension-paragraph';

export type ParagraphAlignment = 'left' | 'center' | 'right';
const ALIGNED = /^:::align-(center|right)\n([\s\S]*?)\n:::(?=\n|$)/;

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
    };
  },
  // Unmarked paragraphs continue through the standard Marked paragraph fallback.
  markdownTokenName: 'mimiAlignedParagraph',
  markdownTokenizer: {
    name: 'mimiAlignedParagraph',
    level: 'block',
    start: (source: string) => source.indexOf(':::align-'),
    tokenize: (source, _tokens, lexer) => {
      const match = ALIGNED.exec(source);
      if (!match || !match[2].trim() || /\n\s*\n/.test(match[2])) return undefined;
      return {
        type: 'mimiAlignedParagraph',
        raw: match[0],
        alignment: match[1],
        tokens: lexer.inlineTokens(match[2]),
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
    return alignment === 'center' || alignment === 'right'
      ? `:::align-${alignment}\n${text}\n:::`
      : text;
  },
});
