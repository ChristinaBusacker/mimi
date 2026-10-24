import MarkdownIt from 'markdown-it';

/** The public, backend and editing renderers must read the same stored metadata. */
export const MIMI_MEDIA_TITLE =
  /^mimi-media:(left|center|right):(small|medium|large|full)(?::(100|[1-9]\d?))?(?::(inline|block|wrap))?$/;

export interface MimiMediaLayout {
  alignment: 'left' | 'center' | 'right';
  size: 'small' | 'medium' | 'large' | 'full';
  widthPercent: number | null;
  displayMode: 'inline' | 'block' | 'wrap' | null;
}

export function parseMimiMediaTitle(value: string | null): MimiMediaLayout | null {
  const match = value ? MIMI_MEDIA_TITLE.exec(value) : null;
  if (!match) return null;
  const widthPercent = match[3] ? Number(match[3]) : null;
  return {
    alignment: match[1] as MimiMediaLayout['alignment'],
    size: match[2] as MimiMediaLayout['size'],
    widthPercent:
      widthPercent !== null && widthPercent >= 10 && widthPercent <= 100 ? widthPercent : null,
    displayMode:
      match[4] === 'inline' || match[4] === 'block' || match[4] === 'wrap' ? match[4] : null,
  };
}

/** Supports the Tiptap color mark, including inline emphasis inside the mark. */
export function installMimiTextColor(markdown: InstanceType<typeof MarkdownIt>): void {
  markdown.inline.ruler.before('emphasis', 'mimiTextColor', (state, silent): boolean => {
    const match = /^%%#([a-fA-F0-9]{6}(?:[a-fA-F0-9]{2})?)\[([^\]\n]+)\]%%/.exec(
      state.src.slice(state.pos),
    );
    if (!match) return false;
    if (!silent) {
      const open = state.push('mimi_text_color_open', 'span', 1);
      // Render color tokens explicitly. The default rule ignores custom mark metadata.
      open.attrSet('data-mimi-color', `#${match[1]}`);
      state.md.inline.parse(match[2], state.md, state.env, state.tokens);
      state.push('mimi_text_color_close', 'span', -1);
    }
    state.pos += match[0].length;
    return true;
  });
  markdown.renderer.rules['mimi_text_color_open'] = (tokens, index): string => {
    const value = tokens[index].attrGet('data-mimi-color') ?? '';
    return /^#[a-fA-F0-9]{6}(?:[a-fA-F0-9]{2})?$/.test(value + '')
      ? `<span style="color:${(value + '').toLowerCase()}">`
      : '<span>';
  };
  markdown.renderer.rules['mimi_text_color_close'] = (): string => '</span>';
}

/** Renders only validated inline scaling emitted by MarkdownFontSize. */
export function installMimiFontSize(markdown: InstanceType<typeof MarkdownIt>): void {
  markdown.inline.ruler.before('emphasis', 'mimiFontSize', (state, silent): boolean => {
    const match = /^%%size-(75|85|100|115|130|150|175|200|250|300)\[([^\]\n]+)\]%%/.exec(
      state.src.slice(state.pos),
    );
    if (!match) return false;
    if (!silent) {
      const open = state.push('mimi_font_size_open', 'span', 1);
      open.attrSet('data-mimi-size', match[1]);
      state.md.inline.parse(match[2], state.md, state.env, state.tokens);
      state.push('mimi_font_size_close', 'span', -1);
    }
    state.pos += match[0].length;
    return true;
  });
  markdown.renderer.rules['mimi_font_size_open'] = (tokens, index): string => {
    const size = tokens[index].attrGet('data-mimi-size') ?? '';
    return /^(?:75|85|100|115|130|150|175|200|250|300)$/.test(size + '')
      ? `<span style="font-size:${size}%">`
      : '<span>';
  };
  markdown.renderer.rules['mimi_font_size_close'] = (): string => '</span>';
}

/** Renders the exact alignment markers emitted by MimiAlignedParagraph. */
export function installMimiParagraphAlignment(markdown: InstanceType<typeof MarkdownIt>): void {
  markdown.block.ruler.before(
    'paragraph',
    'mimiParagraphAlignment',
    (state, startLine, endLine, silent): boolean => {
      const start = state.bMarks[startLine] + state.tShift[startLine];
      const begin = state.src.slice(start, state.eMarks[startLine]);
      const match = /^:::(?:align-(center|right)(-candy)?|candy)\s*$/.exec(begin);
      if (!match) return false;
      let close = startLine + 1;
      while (close < endLine && close - startLine <= 30) {
        const index = state.bMarks[close] + state.tShift[close];
        const line = state.src.slice(index, state.eMarks[close]);
        if (line === ':::') break;
        if (!line.trim()) return false; // One paragraph per alignment marker.
        close++;
      }
      if (close >= endLine || close - startLine > 30) return false;
      if (silent) return true;
      const text = Array.from({ length: close - startLine - 1 }, (_, offset) => {
        const line = startLine + offset + 1;
        return state.src.slice(state.bMarks[line] + state.tShift[line], state.eMarks[line]);
      }).join('\n');
      if (!text.trim()) return false;
      const open = state.push('paragraph_open', 'p', 1);
      if (match[1]) open.attrSet('style', `text-align:${match[1]}`);
      if (match[2] === '-candy' || begin.trim() === ':::candy') open.attrSet('class', 'mimi-candy');
      const inline = state.push('inline', '', 0);
      inline.content = text;
      inline.children = [];
      state.push('paragraph_close', 'p', -1);
      state.line = close + 1;
      return true;
    },
  );
}
