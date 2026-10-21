import MarkdownIt from 'markdown-it';

/** Backend-local runtime implementation: backend rootDir cannot compile shared .ts files. */
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
