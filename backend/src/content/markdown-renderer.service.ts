import { Injectable } from '@nestjs/common';
import MarkdownIt from 'markdown-it';
import sanitizeHtml from 'sanitize-html';

const ASSET_SOURCE_PATTERN =
  /^asset:([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i;

const YOUTUBE_ID_PATTERN = /^[A-Za-z0-9_-]{6,20}$/;

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
        img: ['src', 'alt', 'title', 'loading'],
        div: ['class'],
        iframe: ['src', 'title', 'loading', 'allow', 'allowfullscreen'],
      },
      allowedClasses: {
        div: ['content-youtube'],
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

      const titleAttribute = title ? ` title="${this.markdown.utils.escapeHtml(title + '')}"` : '';

      return (
        `<img src="/api/assets/${assetId}"` + ` alt="${alt}"` + `${titleAttribute} loading="lazy">`
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
        const match = /^:::youtube\s+([^\s]+)\s*$/.exec(openingLine);

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

        state.line = closingLine + 1;

        return true;
      },
    );

    this.markdown.renderer.rules.youtube = (tokens, index): string => {
      const videoId = tokens[index].attrGet('video-id');

      if (!videoId || !YOUTUBE_ID_PATTERN.test(videoId + '')) {
        return '';
      }

      return (
        '<div class="content-youtube">' +
        `<iframe src="https://www.youtube-nocookie.com/embed/${videoId}"` +
        ' title="YouTube video player"' +
        ' loading="lazy"' +
        ' allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"' +
        ' allowfullscreen></iframe>' +
        '</div>'
      );
    };
  }
}
