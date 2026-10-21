import type {
  ContentMediaAlignment,
  ContentMediaSize,
} from '@shared/content/content-media';

import { Node } from '@tiptap/core';
import '@tiptap/markdown';
import { createAssetImageNodeView } from './asset-image-node-view';

const ASSET_SOURCE_PATTERN =
  /^asset:([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i;

interface MarkdownImageToken {
  href?: unknown;
  text?: unknown;
  title?: unknown;
}

export type ImageDisplayMode = 'inline' | 'block' | 'wrap';
interface ContentMediaLayout {
  alignment: ContentMediaAlignment;
  size: ContentMediaSize;
  widthPercent: number | null;
  displayMode: ImageDisplayMode | null;
}
export function imageDisplayMode(value: unknown): ImageDisplayMode | null {
  return value === 'inline' || value === 'block' || value === 'wrap' ? value : null;
}
// Existing image titles have neither a percentage nor a layout mode.
const MEDIA_METADATA_PATTERN =
  /^mimi-media:(left|center|right):(small|medium|large|full)(?::(100|[1-9]\d?))?(?::(inline|block|wrap))?$/;
export function mediaWidth(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isInteger(value)) return null;
  return value >= 10 && value <= 100 ? value : null;
}

const DEFAULT_MEDIA_LAYOUT: ContentMediaLayout = {
  alignment: 'center',
  size: 'large',
  widthPercent: null,
  displayMode: null,
};

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

function readLayout(
  attributes: Record<string, unknown> | undefined,
): ContentMediaLayout {
  const alignment = readNodeAttribute(
    attributes,
    'alignment',
  );
  const size = readNodeAttribute(
    attributes,
    'size',
  );

  return {
    widthPercent: mediaWidth(attributes?.['widthPercent']),
    displayMode: imageDisplayMode(attributes?.['displayMode']),
    alignment:
      alignment === 'left' ||
      alignment === 'right' ||
      alignment === 'center'
        ? alignment
        : DEFAULT_MEDIA_LAYOUT.alignment,
    size:
      size === 'small' ||
      size === 'medium' ||
      size === 'large' ||
      size === 'full'
        ? size
        : DEFAULT_MEDIA_LAYOUT.size,
  };
}

function parseLayoutTitle(
  value: unknown,
): ContentMediaLayout {
  if (typeof value !== 'string') {
    return DEFAULT_MEDIA_LAYOUT;
  }

  const match = MEDIA_METADATA_PATTERN.exec(value);

  return match
    ? {
        alignment: match[1] as ContentMediaAlignment,
        size: match[2] as ContentMediaSize,
        widthPercent: match[3] ? mediaWidth(Number(match[3])) : null,
        displayMode: imageDisplayMode(match[4]),
      }
    : DEFAULT_MEDIA_LAYOUT;
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
      alignment: {
        default: DEFAULT_MEDIA_LAYOUT.alignment,
      },
      size: {
        default: DEFAULT_MEDIA_LAYOUT.size,
      },
      widthPercent: { default: null },
      displayMode: { default: null },
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
            alignment:
              element.getAttribute('data-alignment') ??
              DEFAULT_MEDIA_LAYOUT.alignment,
            size:
              element.getAttribute('data-size') ??
              DEFAULT_MEDIA_LAYOUT.size,
            widthPercent: mediaWidth(Number(element.getAttribute('data-width-percent'))),
            displayMode: imageDisplayMode(element.getAttribute('data-display-mode')),
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

    const layout = readLayout(node.attrs);

    return [
      'img',
      {
        src: `/api/assets/${assetId}`,
        alt:
          readNodeAttribute(node.attrs, 'alt') ?? '',
        'data-asset-id': assetId,
        'data-alignment': layout.alignment,
        'data-size': layout.size,
        ...(layout.displayMode === null ? {} : { 'data-display-mode': layout.displayMode }),
        ...(layout.widthPercent === null ? {} : {
          'data-width-percent': layout.widthPercent,
          style: `width:${layout.widthPercent}%; max-width:100%; height:auto`,
        }),
        class: `content-media media-${layout.alignment} size-${layout.size}` +
          (layout.displayMode ? ` media-mode-${layout.displayMode}` : ''),
        loading: 'lazy',
      },
    ];
  },

  addNodeView() {
    return ({ node, view, getPos }) => createAssetImageNodeView({ node, view, getPos });
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

    const layout = parseLayoutTitle(
      imageToken.title,
    );

    return {
      type: 'assetImage',
      attrs: {
        assetId: match[1],
        alt:
          typeof imageToken.text === 'string'
            ? imageToken.text
            : '',
        alignment: layout.alignment,
        size: layout.size,
        widthPercent: layout.widthPercent,
        displayMode: layout.displayMode,
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
    const layout = readLayout(node.attrs);
    const metadata =
      `mimi-media:${layout.alignment}:${layout.size}` +
      (layout.widthPercent === null ? '' : ':' + layout.widthPercent) +
      (layout.displayMode ? ':' + layout.displayMode : '');

    return (
      `![${alt}](asset:${assetId} "${metadata}")`
    );
  },
});
