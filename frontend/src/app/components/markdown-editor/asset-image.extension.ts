import { Node } from '@tiptap/core';
import '@tiptap/markdown';

const ASSET_SOURCE_PATTERN =
  /^asset:([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i;

interface MarkdownImageToken {
  href?: unknown;
  text?: unknown;
}

function readNodeAttribute(
  attributes: Record<string, unknown> | undefined,
  name: string,
): string | null {
  const value = attributes?.[name];

  return typeof value === 'string' ? value : null;
}

function escapeAltText(value: string): string {
  return value.replace(/[\\[\]]/g, '\\$&');
}

export const AssetImage = Node.create({
  name: 'assetImage',
  group: 'inline',
  inline: true,
  atom: true,
  draggable: true,
  selectable: true,
  markdownTokenName: 'image',

  addAttributes() {
    return {
      assetId: {
        default: null,
      },
      alt: {
        default: '',
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'img[data-asset-id]',
        getAttrs: (element) => {
          const assetId = element.getAttribute('data-asset-id');

          if (!assetId) {
            return false;
          }

          return {
            assetId,
            alt: element.getAttribute('alt') ?? '',
          };
        },
      },
    ];
  },

  renderHTML({ node }) {
    const assetId = readNodeAttribute(
      node.attrs,
      'assetId',
    );

    if (!assetId) {
      return ['span', { 'data-invalid-asset': '' }];
    }

    return [
      'img',
      {
        src: `/api/assets/${assetId}`,
        alt:
          readNodeAttribute(node.attrs, 'alt') ?? '',
        'data-asset-id': assetId,
        loading: 'lazy',
      },
    ];
  },

  parseMarkdown: (token) => {
    const imageToken = token as MarkdownImageToken;
    const source =
      typeof imageToken.href === 'string'
        ? imageToken.href
        : '';
    const match = ASSET_SOURCE_PATTERN.exec(source);

    if (!match) {
      return [];
    }

    return {
      type: 'assetImage',
      attrs: {
        assetId: match[1],
        alt:
          typeof imageToken.text === 'string'
            ? imageToken.text
            : '',
      },
    };
  },

  renderMarkdown: (node) => {
    const assetId = readNodeAttribute(
      node.attrs,
      'assetId',
    );

    if (!assetId) {
      return '';
    }

    const alt = escapeAltText(
      readNodeAttribute(node.attrs, 'alt') ?? '',
    );

    return `![${alt}](asset:${assetId})`;
  },
});
