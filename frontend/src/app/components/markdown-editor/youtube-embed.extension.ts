import type {
  ContentMediaAlignment,
  ContentMediaSize,
} from '@shared/content/content-media';

import { Node } from '@tiptap/core';
import '@tiptap/markdown';

const YOUTUBE_ID_PATTERN = /^[A-Za-z0-9_-]{6,20}$/;
const YOUTUBE_MARKDOWN_PATTERN =
  /^:::youtube\s+([A-Za-z0-9_-]{6,20})(?:\s+(left|center|right))?(?:\s+(small|medium|large|full))?\s*\n:::\s*(?:\n|$)/;

interface YoutubeMarkdownToken {
  videoId?: unknown;
  alignment?: unknown;
  size?: unknown;
}

interface ContentMediaLayout {
  alignment: ContentMediaAlignment;
  size: ContentMediaSize;
}

const DEFAULT_MEDIA_LAYOUT: ContentMediaLayout = {
  alignment: 'center',
  size: 'large',
};

function readNodeAttribute(
  attributes: Record<string, unknown> | undefined,
  name: string,
): string | null {
  const value = attributes?.[name];

  return typeof value === 'string' ? value : null;
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

export const YoutubeEmbed = Node.create({
  name: 'youtubeEmbed',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,
  markdownTokenName: 'youtubeEmbed',

  addAttributes() {
    return {
      videoId: {
        default: null,
      },
      alignment: {
        default: DEFAULT_MEDIA_LAYOUT.alignment,
      },
      size: {
        default: DEFAULT_MEDIA_LAYOUT.size,
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-youtube-id]',
        getAttrs: (element) => {
          const videoId = element.getAttribute(
            'data-youtube-id',
          );

          return videoId &&
            YOUTUBE_ID_PATTERN.test(videoId)
            ? {
                videoId,
                alignment:
                  element.getAttribute('data-alignment') ??
                  DEFAULT_MEDIA_LAYOUT.alignment,
                size:
                  element.getAttribute('data-size') ??
                  DEFAULT_MEDIA_LAYOUT.size,
              }
            : false;
        },
      },
    ];
  },

  renderHTML({ node }) {
    const videoId = readNodeAttribute(
      node.attrs,
      'videoId',
    );

    const layout = readLayout(node.attrs);

    return [
      'div',
      {
        class:
          `markdown-editor__youtube-node content-media media-${layout.alignment} size-${layout.size}`,
        'data-youtube-id': videoId ?? '',
        'data-alignment': layout.alignment,
        'data-size': layout.size,
      },
      videoId
        ? `YouTube · ${videoId}`
        : 'YouTube',
    ];
  },

  markdownTokenizer: {
    name: 'youtubeEmbed',
    level: 'block',
    start: (source) =>
      source.indexOf(':::youtube'),
    tokenize: (source) => {
      const match =
        YOUTUBE_MARKDOWN_PATTERN.exec(source);

      if (!match) {
        return undefined;
      }

      return {
        type: 'youtubeEmbed',
        raw: match[0],
        videoId: match[1],
        alignment:
          match[2] ??
          DEFAULT_MEDIA_LAYOUT.alignment,
        size:
          match[3] ??
          DEFAULT_MEDIA_LAYOUT.size,
      };
    },
  },

  parseMarkdown: (token) => {
    const youtubeToken =
      token as YoutubeMarkdownToken;
    const videoId =
      typeof youtubeToken.videoId === 'string'
        ? youtubeToken.videoId
        : '';

    if (!YOUTUBE_ID_PATTERN.test(videoId)) {
      return [];
    }

    const alignment =
      youtubeToken.alignment === 'left' ||
      youtubeToken.alignment === 'right' ||
      youtubeToken.alignment === 'center'
        ? youtubeToken.alignment
        : DEFAULT_MEDIA_LAYOUT.alignment;
    const size =
      youtubeToken.size === 'small' ||
      youtubeToken.size === 'medium' ||
      youtubeToken.size === 'large' ||
      youtubeToken.size === 'full'
        ? youtubeToken.size
        : DEFAULT_MEDIA_LAYOUT.size;

    return {
      type: 'youtubeEmbed',
      attrs: {
        videoId,
        alignment,
        size,
      },
    };
  },

  renderMarkdown: (node) => {
    const videoId = readNodeAttribute(
      node.attrs,
      'videoId',
    );

    if (
      !videoId ||
      !YOUTUBE_ID_PATTERN.test(videoId)
    ) {
      return '';
    }

    const layout = readLayout(node.attrs);

    return (
      `:::youtube ${videoId} ${layout.alignment} ${layout.size}\n` +
      ':::\n\n'
    );
  },
});
