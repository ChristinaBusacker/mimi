import type { ContentMediaAlignment, ContentMediaSize } from '@shared/content/content-media';

import { Injectable } from '@nestjs/common';
import MarkdownIt from 'markdown-it';
import sanitizeHtml from 'sanitize-html';

const ASSET_SOURCE_PATTERN =
  /^asset:([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i;

const YOUTUBE_ID_PATTERN = /^[A-Za-z0-9_-]{6,20}$/;
const MEDIA_METADATA_PATTERN = /^mimi-media:(left|center|right):(small|medium|large|full)$/;
const YOUTUBE_BLOCK_PATTERN =
  /^:::youtube\s+([A-Za-z0-9_-]{6,20})(?:\s+(left|center|right))?(?:\s+(small|medium|large|full))?\s*$/;

interface ContentMediaLayout {
  alignment: ContentMediaAlignment;
  size: ContentMediaSize;
}

const DEFAULT_MEDIA_LAYOUT: ContentMediaLayout = {
  alignment: 'center',
  size: 'large',
};

@Injectable()
export class MarkdownRendererService {
  private readonly markdown = new MarkdownIt({
    breaks: false,
    html: false,
    linkify: false,
    typographer: false,
  });

  constructor() {
    this.configureAssetImages();
    this.configureYouTubeBlocks();
  }

  render(markdown: string): string {
    if (!markdown.trim()) {
      return '';
    }

    const rendered = this.markdown.render(markdown);

    return sanitizeHtml(rendered, {
      allowedTags: [
        'p',
        'h2',
        'h3',
        'strong',
        'em',
        'a',
        'ul',
        'ol',
        'li',
        'blockquote',
        'br',
        'hr',
        'img',
        'div',
        'iframe',
      ],
      allowedAttributes: {
        a: ['href', 'title'],
        img: ['src', 'alt', 'title', 'loading', 'decoding', 'class'],
        div: ['class'],
        iframe: ['src', 'title', 'loading', 'allow', 'allowfullscreen', 'referrerpolicy'],
      },
      allowedClasses: {
        img: [
          'content-media',
          'media-left',
          'media-center',
          'media-right',
          'size-small',
          'size-medium',
          'size-large',
          'size-full',
        ],
        div: [
          'content-youtube',
          'content-media',
          'media-left',
          'media-center',
          'media-right',
          'size-small',
          'size-medium',
          'size-large',
          'size-full',
        ],
      },
      allowedSchemes: ['http', 'https', 'mailto'],
      allowedIframeHostnames: ['www.youtube-nocookie.com'],
      allowProtocolRelative: false,
    });
  }

  private configureAssetImages(): void {
    this.markdown.renderer.rules.image = (tokens, index): string => {
      const token = tokens[index];
      const source = token.attrGet('src') ?? '';
      const assetMatch = ASSET_SOURCE_PATTERN.exec(source + '');

      if (!assetMatch) {
        return this.markdown.utils.escapeHtml(token.content);
      }

      const assetId = assetMatch[1];
      const alt = this.markdown.utils.escapeHtml(token.content);
      const title = token.attrGet('title');
      const layout = this.parseMediaMetadata(title + '');
      const titleAttribute =
        title && !MEDIA_METADATA_PATTERN.test(title + '')
          ? ` title="${this.markdown.utils.escapeHtml(title + '')}"`
          : '';

      return (
        `<img src="/api/assets/${assetId}"` +
        ` alt="${alt}"` +
        ` class="${this.mediaClasses(layout)}"` +
        `${titleAttribute}` +
        ' loading="lazy" decoding="async">'
      );
    };
  }

  private configureYouTubeBlocks(): void {
    this.markdown.block.ruler.before(
      'fence',
      'youtube',
      (state, startLine, endLine, silent): boolean => {
        const start = state.bMarks[startLine] + state.tShift[startLine];
        const end = state.eMarks[startLine];
        const openingLine = state.src.slice(start, end).trim();
        const match = YOUTUBE_BLOCK_PATTERN.exec(openingLine);

        if (!match || !YOUTUBE_ID_PATTERN.test(match[1])) {
          return false;
        }

        const closingLine = startLine + 1;

        if (closingLine >= endLine) {
          return false;
        }

        const closingStart = state.bMarks[closingLine] + state.tShift[closingLine];
        const closingEnd = state.eMarks[closingLine];

        if (state.src.slice(closingStart, closingEnd).trim() !== ':::') {
          return false;
        }

        if (silent) {
          return true;
        }

        const token = state.push('youtube', '', 0);

        token.block = true;
        token.map = [startLine, closingLine + 1];
        token.attrSet('video-id', match[1]);
        token.attrSet('alignment', match[2] ?? DEFAULT_MEDIA_LAYOUT.alignment);
        token.attrSet('size', match[3] ?? DEFAULT_MEDIA_LAYOUT.size);

        state.line = closingLine + 1;

        return true;
      },
    );

    this.markdown.renderer.rules.youtube = (tokens, index): string => {
      const videoId = tokens[index].attrGet('video-id');

      if (!videoId || !YOUTUBE_ID_PATTERN.test(videoId + '')) {
        return '';
      }

      const layout = this.normalizeMediaLayout(
        tokens[index].attrGet('alignment') + '',
        tokens[index].attrGet('size') + '',
      );

      return (
        `<div class="content-youtube ${this.mediaClasses(layout)}">` +
        `<iframe src="https://www.youtube-nocookie.com/embed/${videoId}"` +
        ' title="YouTube video player"' +
        ' loading="lazy"' +
        ' referrerpolicy="strict-origin-when-cross-origin"' +
        ' allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"' +
        ' allowfullscreen></iframe>' +
        '</div>'
      );
    };
  }

  private parseMediaMetadata(value: string | null): ContentMediaLayout {
    if (!value) {
      return DEFAULT_MEDIA_LAYOUT;
    }

    const match = MEDIA_METADATA_PATTERN.exec(value);

    return match
      ? {
          alignment: match[1] as ContentMediaAlignment,
          size: match[2] as ContentMediaSize,
        }
      : DEFAULT_MEDIA_LAYOUT;
  }

  private normalizeMediaLayout(alignment: string | null, size: string | null): ContentMediaLayout {
    return {
      alignment:
        alignment === 'left' || alignment === 'right' || alignment === 'center'
          ? alignment
          : DEFAULT_MEDIA_LAYOUT.alignment,
      size:
        size === 'small' || size === 'medium' || size === 'large' || size === 'full'
          ? size
          : DEFAULT_MEDIA_LAYOUT.size,
    };
  }

  private mediaClasses(layout: ContentMediaLayout): string {
    return ['content-media', `media-${layout.alignment}`, `size-${layout.size}`].join(' ');
  }
}
