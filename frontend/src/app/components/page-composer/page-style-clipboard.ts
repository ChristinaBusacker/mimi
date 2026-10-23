import type {
  PageAlbumPalette,
  PageBlock,
  PageColumn,
  PageControlAppearance,
  PageRow,
  PageSection,
  PageStyles,
} from '@shared/content/page-document';
import { Injectable, signal } from '@angular/core';

export type ComposerStyleKind = 'section' | 'row' | 'column' | 'block';
type ComposerStyleNode = PageSection | PageRow | PageColumn | PageBlock;

export interface CopiedComposerStyle {
  kind: ComposerStyleKind;
  blockType?: PageBlock['type'];
  /** The ordinal describes the original selection, not a live reference. */
  sourceIndex?: number;
  styles: PageStyles;
  /** Styling of a button's inner control, not its label or navigation target. */
  appearance?: PageControlAppearance;
  /** Album-specific colors are styling and may be copied between matching widgets. */
  palette?: PageAlbumPalette;
  /** Icon size is visual styling; icon name and ARIA label are content. */
  iconSize?: number;
  /** Column alignment is a design property stored outside PageStyles. */
  columnContentAlign?: PageColumn['contentAlign'];
}

const SHARED_STYLE_KEYS = [
  'background', 'backgroundColor', 'textColor', 'padding', 'paddingBox',
  'marginBox', 'gap', 'radius', 'align', 'responsive', 'corners', 'border', 'shadow',
] as const satisfies readonly (keyof PageStyles)[];

/** Only structural nodes have the same settings for background images. */
function layoutKind(kind: ComposerStyleKind): boolean {
  return kind === 'section' || kind === 'row' || kind === 'column';
}

export function copyComposerStyle(
  kind: ComposerStyleKind,
  node: ComposerStyleNode,
  sourceIndex?: number | null,
): CopiedComposerStyle {
  const copy: CopiedComposerStyle = {
    kind,
    styles: structuredClone(node.styles),
  };
  if (sourceIndex && sourceIndex > 0) copy.sourceIndex = sourceIndex;
  if (kind === 'column' && 'blocks' in node) copy.columnContentAlign = node.contentAlign;
  if ('type' in node && kind === 'block') {
    copy.blockType = node.type;
    if (node.type === 'button' && node.appearance) copy.appearance = structuredClone(node.appearance);
    if ((node.type === 'albumDetails' || node.type === 'albumTracks' || node.type === 'albumCredits') && node.palette)
      copy.palette = structuredClone(node.palette);
    if (node.type === 'icon') copy.iconSize = node.size;
  }
  return copy;
}

/**
 * Same type: replace styles fully (also removing stale responsive overrides).
 * Other types: replace common style properties, retaining target-specific styles.
 * Content, links, IDs, layout structure and accordion item content are never transferred.
 */
export function applyComposerStyle(
  targetKind: ComposerStyleKind,
  target: ComposerStyleNode,
  source: CopiedComposerStyle,
): void {
  const targetType = 'type' in target && targetKind === 'block' ? target.type : undefined;
  const sameType = targetKind === source.kind &&
    (targetKind !== 'block' || targetType === source.blockType);

  if (sameType) {
    target.styles = structuredClone(source.styles);
  } else {
    const result: PageStyles = structuredClone(target.styles);
    // Missing common properties must also be removed so the destination inherits defaults.
    for (const key of SHARED_STYLE_KEYS) delete result[key];
    for (const key of SHARED_STYLE_KEYS) {
      if (source.styles[key] !== undefined) {
        // Generic property assignment is intentional: each value comes from PageStyles.
        Object.assign(result, { [key]: structuredClone(source.styles[key]) });
      }
    }
    if (layoutKind(targetKind)) {
      delete result.designBackground;
      if (layoutKind(source.kind) && source.styles.designBackground)
        result.designBackground = structuredClone(source.styles.designBackground);
    }
    target.styles = result;
  }

  if (targetKind === 'column' && source.kind === 'column' && 'blocks' in target) {
    if (source.columnContentAlign) target.contentAlign = source.columnContentAlign;
    else delete target.contentAlign;
  }

  if (targetKind !== 'block' || !('type' in target) || target.type !== source.blockType) return;
  if (target.type === 'button') {
    if (source.appearance) target.appearance = structuredClone(source.appearance);
    else delete target.appearance;
  }
  if (target.type === 'albumDetails' || target.type === 'albumTracks' || target.type === 'albumCredits') {
    if (source.palette) target.palette = structuredClone(source.palette);
    else delete target.palette;
  }
  if (target.type === 'icon' && source.iconSize !== undefined) target.size = source.iconSize;
}

/** In-memory for the current SPA session; never persisted to a document or the server. */
@Injectable({ providedIn: 'root' })
export class PageStyleClipboard {
  private readonly current = signal<CopiedComposerStyle | null>(null);
  readonly copied = this.current.asReadonly();

  copy(kind: ComposerStyleKind, node: ComposerStyleNode, index?: number | null): void {
    this.current.set(copyComposerStyle(kind, node, index));
  }

  paste(kind: ComposerStyleKind, node: ComposerStyleNode): boolean {
    const copied = this.current();
    if (!copied) return false;
    applyComposerStyle(kind, node, copied);
    return true;
  }
}
