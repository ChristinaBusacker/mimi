import type { AlbumBookletContext } from '@shared/content/album-booklet-context';
import type {
  ComposerBackground,
  PageGalleryBlock,
  PageSliderBlock,
  PageDocument,
  PageLocale,
  PageStyles,
  PageStyleValues,
  RowLayout,
} from '@shared/content/page-document';

import { AsyncPipe, NgStyle } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import MarkdownIt from 'markdown-it';
import { Icon } from '../icon/icon';
import { Carousel } from '../carousel/carousel';
import { CarouselSlide } from '../carousel/carousel-slide.directive';
import type { Asset } from '@shared/assets/asset';
import { PageInlineMarkdown } from './page-inline-markdown';
import { I18nPipe } from '../../core/i18n/i18n.pipe';
import { MusicLibraryPlayer } from '../music-library-player/music-library-player';
import { LightboxService } from '../lightbox/lightbox.service';
import { pageGridColumns } from '../../../helpers/pageGridColumns.helper';
import { ResponsiveImageService } from '../../core/assets/responsive-image.service';

export type CanvasKind = 'page' | 'section' | 'row' | 'column' | 'block';
export type CanvasMoveKind = 'section' | 'row' | 'block';
export type CanvasInsertKind = 'section' | 'row' | 'block';
export interface CanvasSelection { kind: CanvasKind; id: string; }
export interface CanvasInsert { kind: CanvasInsertKind; parentId: string; index: number; }
export interface CanvasMove {
  kind: CanvasMoveKind;
  id: string;
  parentId: string;
  index: number;
}
interface DropPosition {
  parentId: string;
  index: number;
  nodeId: string;
  placement: 'before' | 'after' | 'end';
}
interface PointerDrag {
  kind: CanvasMoveKind;
  id: string;
  x: number;
  y: number;
  pointerId: number;
  active: boolean;
}

const ASSET = /^asset:([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i;

/** Identical public and editor canvas. Editor controls never affect the saved document. */
@Component({
  selector: 'app-page-renderer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgStyle, AsyncPipe, I18nPipe, Icon, Carousel, CarouselSlide, PageInlineMarkdown, MusicLibraryPlayer],
  templateUrl: './page-renderer.html',
  styleUrl: './page-renderer.scss',
})
export class PageRenderer {
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly lightbox = inject(LightboxService);
  protected readonly imageSources = inject(ResponsiveImageService);
  private readonly markdown = new MarkdownIt({ html: false, linkify: false, breaks: false });

  constructor() {
    this.markdown.renderer.rules['image'] = (tokens, index): string => {
      const token = tokens[index];
      const match = ASSET.exec(token.attrGet('src')?.toString() ?? '');
      if (!match) return '';
      const assetId = match[1];
      const src = this.imageSources.url(assetId, 1440);
      const srcset = this.imageSources.srcset(assetId);
      const responsive = srcset
        ? ` srcset="${srcset}" sizes="(max-width: 700px) 94vw, 960px"`
        : '';
      return `<img src="${src}"${responsive} alt="${this.markdown.utils.escapeHtml(token.content)}" loading="lazy">`;
    };
  }

  readonly album = input<AlbumBookletContext | null>(null);
  /** Studio rendering must never instantiate an interactive audio player. */
  readonly studio = input(false);
  readonly document = input.required<PageDocument>();
  readonly assets = input<readonly Asset[]>([]);
  readonly locale = input.required<PageLocale>();
  readonly editable = input(false);
  readonly selectedId = input<string | null>(null);
  readonly nodeSelect = output<CanvasSelection>();
  readonly itemMove = output<CanvasMove>();
  readonly insert = output<CanvasInsert>();
  readonly textEdit = output<string>();
  readonly imageEdit = output<string>();
  readonly inlineTextId = input<string | null>(null);
  readonly inlineTextChange = output<{ id: string; markdown: string }>();
  readonly nodeAction = output<{ kind: 'section' | 'row' | 'block'; id: string; action: 'duplicate' | 'remove' }>();

  protected readonly dragging = signal<PointerDrag | null>(null);
  protected readonly pointerX = signal(0);
  protected readonly pointerY = signal(0);
  private readonly target = signal<DropPosition | null>(null);
  private pending: PointerDrag | null = null;

  protected choose(event: Event, kind: CanvasKind, id: string): void {
    if (!this.editable()) return;
    event.stopPropagation();
    this.nodeSelect.emit({ kind, id });
  }

  protected readonly cardBreakpoints = { 1000: { perView: 2 }, 700: { perView: 1 } };

  protected externalLink(href: string): boolean {
    return /^https?:\/\//i.test(href);
  }

  protected openGalleryItem(event: Event, gallery: PageGalleryBlock | PageSliderBlock, index: number): void {
    event.stopPropagation();
    if (this.editable()) {
      this.nodeSelect.emit({ kind: 'block', id: gallery.id });
      return;
    }
    this.lightbox.open(gallery.items.map((item) => ({
      src: this.imageSources.url(item.assetId, Infinity),
      thumbnailSrc: this.imageSources.url(item.assetId, 480),
      alt: item.alt[this.locale()] || item.alt.de,
    })), index);
  }

  protected editText(event: Event, id: string): void {
    if (!this.editable()) return;
    event.stopPropagation();
    this.textEdit.emit(id);
  }

  protected act(event: Event, kind: 'section' | 'row' | 'block', id: string, action: 'duplicate' | 'remove'): void {
    event.stopPropagation();
    this.nodeAction.emit({ kind, id, action });
  }

  protected closeInline(id: string): void {
    this.textEdit.emit(id);
  }

  protected changeInline(id: string, markdown: string): void {
    this.inlineTextChange.emit({ id, markdown });
  }

  protected editImage(event: Event, id: string): void {
    if (!this.editable()) return;
    event.stopPropagation();
    this.imageEdit.emit(id);
  }

  protected requestInsert(event: Event, kind: CanvasInsertKind, parentId: string, index: number): void {
    event.stopPropagation();
    this.insert.emit({ kind, parentId, index });
  }

  protected startPointer(event: PointerEvent, kind: CanvasMoveKind, id: string): void {
    if (!this.editable() || !event.isPrimary || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const handle = event.currentTarget;
    if (!(handle instanceof HTMLElement)) return;
    handle.setPointerCapture(event.pointerId);
    this.pending = { kind, id, x: event.clientX, y: event.clientY, pointerId: event.pointerId, active: false };
  }

  protected pointerMove(event: PointerEvent): void {
    const drag = this.pending;
    if (!drag || event.pointerId !== drag.pointerId) return;
    if (!drag.active && Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 5) return;
    if (!drag.active) {
      drag.active = true;
      this.dragging.set({ ...drag });
    }
    this.pointerX.set(event.clientX + 18);
    this.pointerY.set(event.clientY + 15);
    this.target.set(this.findDrop(event, drag.kind));
  }

  protected pointerUp(event: PointerEvent): void {
    if (this.pending?.pointerId !== event.pointerId) return;
    const drag = this.pending;
    const target = this.target();
    if (drag.active && target) {
      this.itemMove.emit({ kind: drag.kind, id: drag.id, parentId: target.parentId, index: target.index });
    }
    this.cancelPointer();
  }

  protected cancelPointer(): void {
    this.pending = null;
    this.dragging.set(null);
    this.target.set(null);
  }

  protected dropAt(nodeId: string, placement: DropPosition['placement']): boolean {
    const target = this.target();
    return target?.nodeId === nodeId && target.placement === placement;
  }

  private findDrop(event: PointerEvent, kind: CanvasMoveKind): DropPosition | null {
    const element = this.host.nativeElement.ownerDocument.elementFromPoint(event.clientX, event.clientY);
    if (!(element instanceof Element) || !this.host.nativeElement.contains(element)) return null;
    const targetType = kind === 'block' ? 'block' : kind;
    const target = element.closest<HTMLElement>(`[data-editor-kind="${targetType}"]`);
    if (target) {
      const parentId = target.dataset['editorParent'];
      const index = Number(target.dataset['editorIndex']);
      if (!parentId || !Number.isInteger(index)) return null;
      const after = event.clientY > target.getBoundingClientRect().top + target.getBoundingClientRect().height / 2;
      return { parentId, index: index + Number(after), nodeId: target.dataset['editorId'] ?? '', placement: after ? 'after' : 'before' };
    }
    const containerType = kind === 'block' ? 'column' : kind === 'row' ? 'section' : 'page';
    const container = element.closest<HTMLElement>(`[data-editor-kind="${containerType}"]`);
    if (!container) return null;
    const parentId = container.dataset['editorId'];
    if (!parentId) return null;
    const length = this.collectionLength(kind, parentId);
    if (length === null) return null;
    return { parentId, index: length, nodeId: parentId, placement: 'end' };
  }

  private collectionLength(kind: CanvasMoveKind, id: string): number | null {
    const page = this.document();
    if (kind === 'section') return id === page.id ? page.sections.length : null;
    for (const section of page.sections) {
      if (kind === 'row' && section.id === id) return section.rows.length;
      if (kind === 'block') {
        for (const row of section.rows) {
          const column = row.columns.find((item) => item.id === id);
          if (column) return column.blocks.length;
        }
      }
    }
    return null;
  }

  protected grid(layout: RowLayout): string { return pageGridColumns(layout); }
  protected albumDate(value: string | null): string | null {
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const date = new Date(`${value}T00:00:00Z`);
    if (Number.isNaN(date.getTime())) return null;
    return new Intl.DateTimeFormat(this.locale() === 'de' ? 'de-DE' : 'en-US', {
      year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC',
    }).format(date);
  }
  protected albumDuration(seconds: number): string {
    const total = Math.max(0, Math.round(seconds));
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
  }
  protected surface(styles: PageStyles): string { return `page-surface--${styles.background ?? 'none'}`; }
  protected html(content: string): string { return this.markdown.render(content); }
  protected image(assetId: string): string { return this.imageSources.url(assetId, 1440); }
  protected imageSrcset(assetId: string): string | null { return this.imageSources.srcset(assetId); }
  protected gallerySizes(layout: PageGalleryBlock['layout'], index: number): string {
    const featured = index === 0 && layout !== undefined && layout !== 'grid';
    return featured
      ? '(max-width: 580px) 94vw, (max-width: 1100px) 70vw, 800px'
      : '(max-width: 580px) 90vw, (max-width: 1100px) 45vw, 420px';
  }

  protected styleVars(styles: PageStyles): Record<string, string> {
    const result: Record<string, string> = {};
    if (styles.textShadow === 'readability')
      result['text-shadow'] = 'var(--text-shadow, 0px 0px 5px rgba(5, 2, 1, 0.51))';
    else if (styles.textShadow === 'strong')
      result['text-shadow'] = '0px 2px 9px rgba(5, 2, 1, 0.85)';
    else if (styles.textShadow === 'none') result['text-shadow'] = 'none';
    if (styles.corners) {
      const c = styles.corners;
      result['border-radius'] = `${c.topLeft}px ${c.topRight}px ${c.bottomRight}px ${c.bottomLeft}px`;
    }
    if (styles.border) {
      result['border'] = `${styles.border.width}px ${styles.border.style} ${styles.border.color}`;
    }
    if (styles.shadow) {
      const s = styles.shadow;
      result['box-shadow'] = `${s.x}px ${s.y}px ${s.blur}px ${s.spread}px ${s.color}`;
    }
    // A node's own design must not leak down via inherited CSS custom properties.
    result['--pc-design-color'] = styles.designBackground?.kind === 'color'
      ? styles.designBackground.color : styles.designBackground ? 'transparent' : 'var(--pc-background-color, transparent)';
    if (styles.spacing) result['--pc-padding'] = `var(--composer-section-${styles.spacing})`;
    // Always reset these per node: CSS variables otherwise leak into descendants.
    result['--pc-design-image'] = styles.designBackground
      ? this.backgroundImage(styles.designBackground) : 'none';
    result['--pc-design-position'] = styles.designBackground?.kind === 'image'
      ? styles.designBackground.position : 'center';
    const bg = (value: PageStyleValues): string => {
      if (value.backgroundColor) return value.backgroundColor;
      switch (value.background) {
        case 'glass': return 'rgb(24 16 34 / 52%)';
        case 'solid': return '#282034';
        case 'accent': return 'rgb(218 139 185 / 16%)';
        default: return 'transparent';
      }
    };
    const base: PageStyleValues = {
      background: styles.background ?? 'none', backgroundColor: styles.backgroundColor,
      textColor: styles.textColor, padding: styles.padding ?? 0, gap: styles.gap ?? 16,
      radius: styles.radius ?? 0, align: styles.align ?? 'left',
    };
    const keys = ['padding', 'gap', 'radius', 'align', 'text-color', 'background-color'] as const;
    const css = (values: PageStyleValues, key: typeof keys[number]): string | undefined => {
      switch (key) {
        case 'padding': return values.padding === undefined ? undefined : `${values.padding}px`;
        case 'gap': return values.gap === undefined ? undefined : `${values.gap}px`;
        case 'radius': return values.radius === undefined ? undefined : `${values.radius}px`;
        case 'align': return values.align;
        case 'text-color': return values.textColor;
        case 'background-color': return values.background !== undefined || values.backgroundColor ? bg(values) : undefined;
      }
    };
    for (const key of keys) {
      result[`--pc-${key}`] = css(base, key) ?? 'inherit';
      result[`--pc-tablet-${key}`] = css(styles.responsive?.tablet ?? {}, key) ?? `var(--pc-${key})`;
      result[`--pc-mobile-${key}`] = css(styles.responsive?.mobile ?? {}, key) ?? `var(--pc-tablet-${key})`;
    }
    if (styles.spacing) {
      // A semantic spacing preset overrides old numeric values at every breakpoint.
      for (const key of ['--pc-padding', '--pc-tablet-padding', '--pc-mobile-padding'])
        result[key] = `var(--composer-section-${styles.spacing})`;
    }
    return result;
  }

  private backgroundImage(value: ComposerBackground): string {
    if (value.kind === 'color') return 'none';
    if (value.kind === 'gradient')
      return `linear-gradient(${value.angle}deg, ${value.from}, ${value.to})`;
    const shade = value.overlay === 'strong' ? 'rgb(15 10 25 / 62%)'
      : value.overlay === 'soft' ? 'rgb(15 10 25 / 30%)' : 'transparent';
    const asset = this.imageSources.url(value.assetId, 1920);
    return `linear-gradient(${shade}, ${shade}), url("${asset}")`;
  }
}
