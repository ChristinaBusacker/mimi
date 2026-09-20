import { Node } from '@tiptap/core';
import '@tiptap/markdown';

const YOUTUBE_ID_PATTERN = /^[A-Za-z0-9_-]{6,20}$/;
const YOUTUBE_MARKDOWN_PATTERN =
  /^:::youtube\s+([A-Za-z0-9_-]{6,20})\s*\n:::\s*(?:\n|$)/;

interface YoutubeMarkdownToken {
  videoId?: unknown;
}

function readNodeAttribute(
  attributes: Record<string, unknown> | undefined,
  name: string,
): string | null {
  const value = attributes?.[name];

  return typeof value === 'string' ? value : null;
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

    return [
      'div',
      {
        class: 'markdown-editor__youtube-node',
        'data-youtube-id': videoId ?? '',
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

    return {
      type: 'youtubeEmbed',
      attrs: {
        videoId,
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

    return `:::youtube ${videoId}\n:::\n\n`;
  },
});
