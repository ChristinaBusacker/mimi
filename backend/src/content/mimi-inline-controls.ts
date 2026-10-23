import MarkdownIt from 'markdown-it';

/** Delimited, URL-encoded tokens: no raw HTML or user-supplied SVG enters Markdown. */
const TOKEN = /^%%mimi-(icon|button)\[([^\]\n]{1,950})\]%%/;
const HEX = /^#[0-9a-f]{8}$/i;
const ICON_PATHS: Readonly<Record<string, string>> = {
  heart: 'M2 8.5C2 5.46243 4.46243 3 7.5 3C9.36016 3 11.0046 3.92345 12 5.33692C12.9954 3.92345 14.6398 3 16.5 3C19.5376 3 22 5.46243 22 8.5C22 16 12 21.4852 12 21.4852C12 21.4852 2 16 2 8.5Z',
  music: 'M12 13.5351V3H20V6H14V17C14 19.2091 12.2091 21 10 21C7.79086 21 6 19.2091 6 17C6 14.7909 7.79086 13 10 13C10.7286 13 11.4117 13.1948 12 13.5351Z',
  play: 'M19.376 12.4161L8.77735 19.4818C8.54759 19.635 8.23715 19.5729 8.08397 19.3432C8.02922 19.261 8 19.1645 8 19.0658V4.93433C8 4.65818 8.22386 4.43433 8.5 4.43433C8.59871 4.43433 8.69522 4.46355 8.77735 4.5183L19.376 11.584C19.6057 11.7372 19.6678 12.0477 19.5146 12.2774C19.478 12.3323 19.4309 12.3795 19.376 12.4161Z',
  check: 'M9.9997 15.1709L19.1921 5.97852L20.6063 7.39273L9.9997 17.9993L3.63574 11.6354L5.04996 10.2212L9.9997 15.1709Z',
  link: 'M18.3638 15.5355L16.9496 14.1213L18.3638 12.7071C20.3164 10.7545 20.3164 7.58866 18.3638 5.63604C16.4112 3.68341 13.2453 3.68341 11.2927 5.63604L9.87849 7.05025L8.46428 5.63604L9.87849 4.22182C12.6122 1.48815 17.0443 1.48815 19.778 4.22182C22.5117 6.95549 22.5117 11.3876 19.778 14.1213L18.3638 15.5355ZM15.5353 18.364L14.1211 19.7782C11.3875 22.5118 6.95531 22.5118 4.22164 19.7782C1.48797 17.0445 1.48797 12.6123 4.22164 9.87868L5.63585 8.46446L7.05007 9.87868L5.63585 11.2929C3.68323 13.2455 3.68323 16.4113 5.63585 18.364C7.58847 20.3166 10.7543 20.3166 12.7069 18.364L14.1211 16.9497L15.5353 18.364ZM14.8282 7.75736L16.2425 9.17157L9.17139 16.2426L7.75717 14.8284L14.8282 7.75736Z',
  arrow: 'M16.1716 10.9999L10.8076 5.63589L12.2218 4.22168L20 11.9999L12.2218 19.778L10.8076 18.3638L16.1716 12.9999H4V10.9999H16.1716Z',
  search: 'M18.031 16.6168L22.3137 20.8995L20.8995 22.3137L16.6168 18.031C15.0769 19.263 13.124 20 11 20C6.032 20 2 15.968 2 11C2 6.032 6.032 2 11 2C15.968 2 20 6.032 20 11C20 13.124 19.263 15.0769 18.031 16.6168ZM16.0247 15.8748C17.2475 14.6146 18 12.8956 18 11C18 7.1325 14.8675 4 11 4C15.8748 4 18 7.1325 18 11C18 13.124 17.2475 14.8748 16.0247 15.8748Z',
  community: 'M6.45455 19L2 22.5V4C2 3.44772 2.44772 3 3 3H21C21.5523 3 22 3.44772 22 4V18C22 18.5523 21.5523 19 21 19H6.45455ZM12.0178 14.6997L15.3765 11.341C16.2552 10.4623 16.2552 9.03769 15.3765 8.15901C14.4978 7.28033 13.0732 7.28033 12.1945 8.15901L12.0178 8.33579L11.841 8.15901C10.9623 7.28033 9.53769 7.28033 8.65901 8.15901C7.78033 9.03769 7.78033 10.4623 8.65901 11.341L12.0178 14.6997Z',
};
export const MIMI_INLINE_ICONS = Object.keys(ICON_PATHS);
export const MIMI_INLINE_ICON_DEFAULTS = { name: 'heart', size: 24, color: '#ed9fcaff' } as const;
export type MimiInlineControl =
  | { kind: 'icon'; name: string; size: number; color: string }
  | { kind: 'button'; label: string; href: string; variant: 'primary' | 'secondary' | 'outline' };

export function validInlineDestination(href: string): boolean {
  if (!href || href.length > 800 || /[<>\\\s]/.test(href)) return false;
  if (href.startsWith('/')) return !href.startsWith('//');
  try { const url = new URL(href); return url.protocol === 'https:' && !!url.hostname && !url.username && !url.password; }
  catch { return false; }
}
export function parseMimiInline(kind: string, payload: string): MimiInlineControl | null {
  const parts = payload.split('|');
  if (kind === 'icon' && parts.length === 3) {
    const [name, size, color] = parts;
    const px = Number(size);
    return ICON_PATHS[name] && Number.isInteger(px) && px >= 12 && px <= 128 && HEX.test(color)
      ? { kind: 'icon', name, size: px, color: color.toLowerCase() } : null;
  }
  if (kind === 'button' && parts.length === 3) {
    try {
      const label = decodeURIComponent(parts[0]);
      const href = decodeURIComponent(parts[1]);
      const variant = parts[2];
      if (label && label.length <= 160 && !/[<>\r\n]/.test(label) && validInlineDestination(href) &&
          (variant === 'primary' || variant === 'secondary' || variant === 'outline'))
        return { kind: 'button', label, href, variant };
    } catch { /* reject malformed percent escapes */ }
  }
  return null;
}
export function serializeMimiInline(widget: MimiInlineControl): string {
  return widget.kind === 'icon'
    ? `%%mimi-icon[${widget.name}|${widget.size}|${widget.color}]%%`
    : `%%mimi-button[${encodeURIComponent(widget.label)}|${encodeURIComponent(widget.href)}|${widget.variant}]%%`;
}
export function readMimiInline(source: string): { widget: MimiInlineControl; raw: string } | null {
  const match = TOKEN.exec(source);
  if (!match) return null;
  const widget = parseMimiInline(match[1], match[2]);
  return widget ? { widget, raw: match[0] } : null;
}
const escape = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export function mimiInlineHtml(widget: MimiInlineControl): string {
  if (widget.kind === 'icon')
    return `<svg class="mimi-inline-icon" role="img" aria-label="${escape(widget.name)}" viewBox="0 0 24 24" width="${widget.size}" height="${widget.size}" style="color:${widget.color}"><path fill="currentColor" d="${ICON_PATHS[widget.name]}"></path></svg>`;
  const cls = `mimi-inline-button mimi-inline-button--${widget.variant}`;
  return `<a class="${cls}" href="${escape(widget.href)}"${widget.href.startsWith('https://') ? ' target="_blank" rel="noopener noreferrer"' : ''}>${escape(widget.label)}</a>`;
}
export function installMimiInlineControls(markdown: InstanceType<typeof MarkdownIt>): void {
  markdown.inline.ruler.before('emphasis', 'mimiInlineControls', (state, silent): boolean => {
    const found = readMimiInline(state.src.slice(state.pos));
    if (!found) return false;
    if (!silent) { const token = state.push('mimi_inline_control', '', 0); token.content = found.raw; }
    state.pos += found.raw.length;
    return true;
  });
  markdown.renderer.rules['mimi_inline_control'] = (tokens, index): string => {
    const parsed = readMimiInline(tokens[index].content);
    return parsed ? mimiInlineHtml(parsed.widget) : '';
  };
}
