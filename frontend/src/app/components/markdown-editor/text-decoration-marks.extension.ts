import { Mark } from '@tiptap/core';
import '@tiptap/markdown';

export const MarkdownUnderline =
  Mark.create({
    name: 'underline',

    parseHTML() {
      return [
        {
          tag: 'u',
        },
      ];
    },

    renderHTML() {
      return ['u', 0];
    },

    markdownTokenizer: {
      name: 'underline',
      level: 'inline',
      start: (source) =>
        source.indexOf('++'),
      tokenize: (
        source,
        _tokens,
        lexer,
      ) => {
        const match =
          /^\+\+([^\n]+?)\+\+/.exec(
            source,
          );

        if (!match) {
          return undefined;
        }

        return {
          type: 'underline',
          raw: match[0],
          text: match[1],
          tokens:
            lexer.inlineTokens(
              match[1],
            ),
        };
      },
    },

    parseMarkdown: (
      token,
      helpers,
    ) =>
      helpers.applyMark(
        'underline',
        helpers.parseInline(
          token.tokens ?? [],
        ),
      ),

    renderMarkdown: (
      node,
      helpers,
    ) =>
      `++${helpers.renderChildren(
        node.content ?? [],
      )}++`,
  });

export const MarkdownStrike =
  Mark.create({
    name: 'strike',

    parseHTML() {
      return [
        {
          tag: 's',
        },
        {
          tag: 'del',
        },
        {
          tag: 'strike',
        },
      ];
    },

    renderHTML() {
      return ['s', 0];
    },

    markdownTokenizer: {
      name: 'strike',
      level: 'inline',
      start: (source) =>
        source.indexOf('~~'),
      tokenize: (
        source,
        _tokens,
        lexer,
      ) => {
        const match =
          /^~~([^\n]+?)~~/.exec(
            source,
          );

        if (!match) {
          return undefined;
        }

        return {
          type: 'strike',
          raw: match[0],
          text: match[1],
          tokens:
            lexer.inlineTokens(
              match[1],
            ),
        };
      },
    },

    parseMarkdown: (
      token,
      helpers,
    ) =>
      helpers.applyMark(
        'strike',
        helpers.parseInline(
          token.tokens ?? [],
        ),
      ),

    renderMarkdown: (
      node,
      helpers,
    ) =>
      `~~${helpers.renderChildren(
        node.content ?? [],
      )}~~`,
  });
