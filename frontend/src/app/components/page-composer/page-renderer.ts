import type { AlbumBookletContext } from '@shared/content/album-booklet-context';
import type {
  ComposerBackground,
  PageGalleryBlock,
  PageBlock,
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
  DestroyRef,
  ElementRef,
  NgZone,
  afterEveryRender,
  afterNextRender,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import type { SafeHtml } from '@angular/platform-browser';
import MarkdownIt from 'markdown-it';
import sanitizeHtml from 'sanitize-html';
import { installMimiTextColor, installMimiParagraphAlignment, parseMimiMediaTitle } from '@shared/content/mimi-markdown-rendering';
import { installMimiInlineControls } from '@shared/content/mimi-inline-controls';
import { Icon } from '../icon/icon';
import { Carousel } from '../carousel/carousel';
import { CarouselSlide } from '../carousel/carousel-slide.directive';
import type { Asset } from '@shared/assets/asset';
import { PageInlineMarkdown } from './page-inline-markdown';
import { I18nPipe } from '../../core/i18n/i18n.pipe';
import { AlbumTrackList } from '../album-track-list/album-track-list';
import { LightboxService } from '../lightbox/lightbox.service';
import { pageGridColumns } from '../../../helpers/pageGridColumns.helper';
import { ResponsiveImageService } from '../../core/assets/responsive-image.service';
import { PAGE_STYLE_DEFAULTS, pageTextColorVars } from './page-style-defaults';
import { PAGE_THEME_FONTS, pageThemeVars } from './page-theme';

export type CanvasKind = 'page' | 'section' | 'row' | 'column' | 'block';
export type CanvasMoveKind = 'section' | 'row' | 'block';
export type CanvasInsertKind = 'section' | 'row' | 'block';
export interface CanvasSelection {
  kind: CanvasKind;
  id: string;
}
export interface CanvasInsert {
  kind: CanvasInsertKind;
  parentId: string;
  index: number;
}
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
  imports: [
    NgStyle,
    AsyncPipe,
    I18nPipe,
    Icon,
    Carousel,
    CarouselSlide,
    RouterLink,
    PageInlineMarkdown,
    AlbumTrackList,
  ],
  templateUrl: './page-renderer.html',
  styleUrl: './page-renderer.scss',
})
export class PageRenderer {
  private readonly host: ElementRef<HTMLElement> = inject(ElementRef);
  private readonly zone = inject(NgZone);
  private readonly destroyRef = inject(DestroyRef);
  private scheduleParallax: (() => void) | null = null;
  private readonly lightbox = inject(LightboxService);
  private readonly sanitizer = inject(DomSanitizer);
  protected readonly imageSources = inject(ResponsiveImageService);
  private readonly markdown = new MarkdownIt({ html: false, linkify: false, breaks: false });

  constructor() {
    // Browser-only: track the actual scroll container, including the Composer canvas.
    afterNextRender(() => this.initParallax());
    afterEveryRender(() => this.scheduleParallax?.());
    installMimiTextColor(this.markdown);
    installMimiParagraphAlignment(this.markdown);
    installMimiInlineControls(this.markdown);
    this.markdown.renderer.rules['image'] = (tokens, index): string => {
      const token = tokens[index];
      const match = ASSET.exec(token.attrGet('src')?.toString() ?? '');
      if (!match) return '';
      const assetId = match[1];
      const layout = parseMimiMediaTitle(token.attrGet('title') + '');
      const widthStyle =
        layout?.widthPercent === null || !layout
          ? ''
          : ` style="width:${layout.widthPercent}%;max-width:100%;height:auto"`;
      const layoutClass = layout
        ? ` class="content-media media-${layout.alignment} size-${layout.size}` +
          (layout.displayMode ? ` media-mode-${layout.displayMode}` : '') +
          '"'
        : '';
      const src = this.imageSources.url(assetId, 1440);
      const srcset = this.imageSources.srcset(assetId);
      const responsive = srcset ? ` srcset="${srcset}" sizes="(max-width: 700px) 94vw, 960px"` : '';
      return `<img src="${src}"${responsive}${layoutClass}${widthStyle} alt="${this.markdown.utils.escapeHtml(token.content)}" loading="lazy">`;
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
  readonly nodeAction = output<{
    kind: 'section' | 'row' | 'block';
    id: string;
    action: 'duplicate' | 'remove';
  }>();

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
  protected readonly sliderBreakpoints = { 600: { perView: 1 } };
  protected galleryCount(count: number): number {
    return Math.min(6, count);
  }
  protected controlAppearanceVars(appearance: unknown): Record<string, string> {
    if (!appearance || typeof appearance !== 'object') return {};
    const a = appearance as Record<string, unknown>;
    const out: Record<string, string> = {};
    const colorKeys: Record<string, string> = {
      backgroundColor: '--pc-control-bg', hoverBackgroundColor: '--pc-control-hover-bg',
      textColor: '--pc-control-color', headerBackgroundColor: '--pc-control-header-bg',
      headerColor: '--pc-control-header-color', borderColor: '--pc-control-border-color',
    };
    for (const [key, token] of Object.entries(colorKeys))
      if (typeof a[key] === 'string') out[token] = a[key] as string;
    for (const [key, token, unit] of [
      ['borderWidth','--pc-control-border-width','px'], ['radius','--pc-control-radius','px'],
      ['fontSize','--pc-control-font-size','px'], ['paddingX','--pc-control-padding-x','px'],
      ['paddingY','--pc-control-padding-y','px'],
    ]) if (typeof a[key] === 'number') out[token] = `${a[key]}${unit}`;
    if (a['shadow']) {
      const shadow = a['shadow'] as { x: number; y: number; blur: number; spread: number; color: string };
      out['--pc-control-shadow'] = `${shadow.x}px ${shadow.y}px ${shadow.blur}px ${shadow.spread}px ${shadow.color}`;
    }
    return out;
  }

  protected externalLink(href: string): boolean {
    return /^https?:\/\//i.test(href);
  }
  protected composerActionClick(event: MouseEvent): void {
    // Inside the editor or its preview, clicking must never navigate away.
    if (this.studio() || this.editable()) event.preventDefault();
  }

  protected openGalleryItem(
    event: Event,
    gallery: PageGalleryBlock | PageSliderBlock,
    index: number,
  ): void {
    event.stopPropagation();
    if (this.editable()) {
      this.nodeSelect.emit({ kind: 'block', id: gallery.id });
      return;
    }
    this.lightbox.open(
      gallery.items.map((item) => ({
        src: this.imageSources.url(item.assetId, Infinity),
        thumbnailSrc: this.imageSources.url(item.assetId, 480),
        alt: item.alt[this.locale()] || item.alt.de,
      })),
      index,
    );
  }

  protected editText(event: Event, id: string): void {
    if (!this.editable()) return;
    event.stopPropagation();
    this.textEdit.emit(id);
  }

  protected act(
    event: Event,
    kind: 'section' | 'row' | 'block',
    id: string,
    action: 'duplicate' | 'remove',
  ): void {
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

  protected requestInsert(
    event: Event,
    kind: CanvasInsertKind,
    parentId: string,
    index: number,
  ): void {
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
    this.pending = {
      kind,
      id,
      x: event.clientX,
      y: event.clientY,
      pointerId: event.pointerId,
      active: false,
    };
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
      this.itemMove.emit({
        kind: drag.kind,
        id: drag.id,
        parentId: target.parentId,
        index: target.index,
      });
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
    const element = this.host.nativeElement.ownerDocument.elementFromPoint(
      event.clientX,
      event.clientY,
    );
    if (!(element instanceof Element) || !this.host.nativeElement.contains(element)) return null;
    const targetType = kind === 'block' ? 'block' : kind;
    const target = element.closest<HTMLElement>(`[data-editor-kind="${targetType}"]`);
    if (target) {
      const parentId = target.dataset['editorParent'];
      const index = Number(target.dataset['editorIndex']);
      if (!parentId || !Number.isInteger(index)) return null;
      const after =
        event.clientY >
        target.getBoundingClientRect().top + target.getBoundingClientRect().height / 2;
      return {
        parentId,
        index: index + Number(after),
        nodeId: target.dataset['editorId'] ?? '',
        placement: after ? 'after' : 'before',
      };
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

  protected grid(layout: RowLayout): string {
    return pageGridColumns(layout);
  }
  protected albumDate(value: string | null): string | null {
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const date = new Date(`${value}T00:00:00Z`);
    if (Number.isNaN(date.getTime())) return null;
    return new Intl.DateTimeFormat(this.locale() === 'de' ? 'de-DE' : 'en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'UTC',
    }).format(date);
  }
  protected albumTags(entry: AlbumBookletContext): readonly string[] {
    const tags = entry.editorial.tags;
    const translated = tags?.[this.locale()];
    return translated?.length ? translated : tags?.de ?? [];
  }
  protected surface(styles: PageStyles): string {
    return `page-surface--${styles.background ?? 'none'}`;
  }
  protected html(content: string): SafeHtml {
    // Only MarkdownIt-generated markup reaches this whitelist. Never trust raw editor HTML.
    const generated = this.markdown.render(content);
    const clean = sanitizeHtml(generated, {
      parser: { lowerCaseAttributeNames: false },
      allowedTags: [...sanitizeHtml.defaults.allowedTags, 'img', 'span', 'svg', 'path'],
      allowedAttributes: {
        ...sanitizeHtml.defaults.allowedAttributes,
        a: ['href', 'title', 'class', 'target', 'rel'],
        img: ['src', 'srcset', 'sizes', 'alt', 'loading', 'class', 'style'],
        p: ['style'],
        svg: ['class', 'viewBox', 'width', 'height', 'style', 'role', 'aria-label'],
        path: ['d', 'fill'],
        span: ['style'],
      },
      allowedClasses: {
        a: ['mimi-inline-button', 'mimi-inline-button--primary', 'mimi-inline-button--secondary', 'mimi-inline-button--outline'],
        svg: ['mimi-inline-icon'],
        img: [
          'content-media',
          'media-left',
          'media-center',
          'media-right',
          'size-small',
          'size-medium',
          'size-large',
          'size-full',
          'media-mode-inline',
          'media-mode-block',
          'media-mode-wrap',
        ],
      },
      allowedStyles: {
        span: { color: [/^#[a-f0-9]{6}(?:[a-f0-9]{2})?$/i] },
        p: { 'text-align': [/^(?:left|center|right)$/] },
        svg: { color: [/^#[a-f0-9]{8}$/i] },
        img: {
          width: [/^(?:100|[1-9]\d?)%$/],
          'max-width': [/^100%$/],
          height: [/^auto$/],
        },
      },
      allowedSchemes: ['https', 'http', 'mailto'],
      allowProtocolRelative: false,
    });
    // Sanitized HTML is necessary here: Angular strips the validated inline styles
    // when assigning a plain string to [innerHTML].
    return this.sanitizer.bypassSecurityTrustHtml(clean);
  }
  protected image(assetId: string): string {
    return this.imageSources.url(assetId, 1440);
  }
  protected imageSrcset(assetId: string): string | null {
    return this.imageSources.srcset(assetId);
  }
  protected gallerySizes(layout: PageGalleryBlock['layout'], index: number): string {
    const featured = index === 0 && layout !== undefined && layout !== 'grid';
    return featured
      ? '(max-width: 580px) 94vw, (max-width: 1100px) 70vw, 800px'
      : '(max-width: 580px) 90vw, (max-width: 1100px) 45vw, 420px';
  }

  private initParallax(): void {
    const doc = this.host.nativeElement.ownerDocument;
    const win = doc.defaultView;
    if (!win) return;
    const reducedMotion = win.matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0;
    const update = (): void => {
      frame = 0;
      const enabled = win.innerWidth > 900 && !reducedMotion.matches;
      const height = win.innerHeight;
      for (const element of this.host.nativeElement.querySelectorAll<HTMLElement>(
        '.page-document__node--parallax',
      )) {
        const rect = element.getBoundingClientRect();
        if (!enabled || rect.bottom <= 0 || rect.top >= height) {
          element.style.removeProperty('--pc-parallax-shift');
          continue;
        }
        const progress = Math.max(0, Math.min(1, (height - rect.top) / (height + rect.height)));
        element.style.setProperty(
          '--pc-parallax-shift',
          `${((progress - 0.5) * 140).toFixed(1)}px`,
        );
      }
    };
    const schedule = (): void => {
      if (!frame) frame = win.requestAnimationFrame(update);
    };
    this.scheduleParallax = schedule;
    this.zone.runOutsideAngular(() => {
      doc.addEventListener('scroll', schedule, true);
      win.addEventListener('resize', schedule);
      reducedMotion.addEventListener('change', schedule);
    });
    this.destroyRef.onDestroy(() => {
      doc.removeEventListener('scroll', schedule, true);
      win.removeEventListener('resize', schedule);
      reducedMotion.removeEventListener('change', schedule);
      if (frame) win.cancelAnimationFrame(frame);
      this.scheduleParallax = null;
    });
    schedule();
  }

  protected backgroundParallax(styles: PageStyles): boolean {
    return styles.designBackground?.kind === 'image' && styles.designBackground.parallax === true;
  }

  /** Existing album blocks keep their legacy palette until a shared surface overrides it. */
  protected blockStyleVars(block: PageBlock): Record<string, string> {
    const vars = this.styleVars(block.styles);
    if (block.type === 'text') {
      for (const field of ['fontBody', 'fontHeading'] as const) {
        const font = PAGE_THEME_FONTS.find((entry) => entry.id === block.styles[field]);
        const name = field === 'fontBody' ? 'body' : 'heading';
        vars[`--pc-block-font-${name}`] = font?.css ?? `var(--pc-theme-font-${name}, inherit)`;
      }
    }
    if (block.type !== 'albumDetails' && block.type !== 'albumTracks' && block.type !== 'albumCredits')
      return vars;
    const { styles, palette } = block;
    const hasBackground = !!styles.designBackground || !!styles.backgroundColor ||
      (styles.background !== undefined && styles.background !== 'none');
    if (styles.designBackground?.kind === 'color')
      vars['--pc-background-color'] = styles.designBackground.color;
    if (!hasBackground) {
      vars['--pc-design-color'] = palette?.backgroundColor ??
        (block.type === 'albumDetails' ? 'rgb(20 14 32 / 45%)' : 'rgb(18 11 30 / 38%)');
      // Tablet/mobile use --pc-background-color, not the design token.
      vars['--pc-background-color'] = vars['--pc-design-color'];
    }
    if (!styles.textColor && palette?.textColor) {
      vars['--pc-text-color'] = palette.textColor;
      if (!styles.responsive?.tablet?.textColor) vars['--pc-tablet-text-color'] = 'var(--pc-text-color)';
      if (!styles.responsive?.mobile?.textColor) vars['--pc-mobile-text-color'] = 'var(--pc-tablet-text-color)';
    }
    if (!styles.paddingBox && (!styles.padding || styles.padding === 0) && !styles.spacing)
      vars['--pc-box-padding'] = block.type === 'albumDetails'
        ? 'clamp(18px, 2.6vw, 30px)' : 'clamp(18px, 3vw, 36px)';
    if (!styles.corners && (!styles.radius || styles.radius === 0))
      vars['--pc-radius'] = block.type === 'albumDetails' ? '14px' : '16px';
    if (!styles.border && styles.backgroundColor !== '#00000000')
      vars['border'] = '1px solid rgb(255 255 255 / 15%)';
    if (palette?.iconColor) vars['--pc-album-icon'] = palette.iconColor;
    if (palette?.subtitleColor) vars['--pc-album-subtitle'] = palette.subtitleColor;
    return vars;
  }

  protected documentStyleVars(): Record<string, string> {
    const document = this.document();
    const theme = document.theme;
    const result = { ...this.styleVars(document.styles, true), ...pageThemeVars(theme) };
    if (theme && !document.styles.textColor && theme.colors?.text)
      result['--pc-text-color'] = theme.colors.text;
    if (theme?.colors?.background && !document.styles.designBackground &&
        !document.styles.backgroundColor && (!document.styles.background || document.styles.background === 'none'))
      result['--pc-design-color'] = theme.colors.background;
    return result;
  }

  protected styleVars(styles: PageStyles, isPage = false): Record<string, string> {
    const result: Record<string, string> = {};
    if (styles.textShadow === 'readability')
      result['text-shadow'] = 'var(--text-shadow, 0px 0px 5px rgba(5, 2, 1, 0.51))';
    else if (styles.textShadow === 'strong')
      result['text-shadow'] = '0px 2px 9px rgba(5, 2, 1, 0.85)';
    else if (styles.textShadow === 'none') result['text-shadow'] = 'none';
    if (styles.corners) {
      const c = styles.corners;
      result['border-radius'] =
        `${c.topLeft}px ${c.topRight}px ${c.bottomRight}px ${c.bottomLeft}px`;
    }
    if (styles.border) {
      result['border'] = `${styles.border.width}px ${styles.border.style} ${styles.border.color}`;
    }
    if (styles.shadow) {
      const s = styles.shadow;
      result['box-shadow'] = `${s.x}px ${s.y}px ${s.blur}px ${s.spread}px ${s.color}`;
    }
    // Heading overrides are local to the text block. Inherit its normal text color otherwise.
    result['--pc-heading-color'] = styles.headingColor ?? 'var(--pc-theme-color-heading, inherit)';
    // A node's own design must not leak down via inherited CSS custom properties.
    result['--pc-design-color'] =
      styles.designBackground?.kind === 'color'
        ? styles.designBackground.color
        : styles.designBackground
          ? 'transparent'
          : 'var(--pc-background-color, transparent)';
    if (styles.spacing) result['--pc-padding'] = `var(--composer-section-${styles.spacing})`;
    // Always reset these per node: CSS variables otherwise leak into descendants.
    result['--pc-design-image'] = styles.designBackground
      ? this.backgroundImage(styles.designBackground)
      : 'none';
    // The overlay scrolls normally; the image layer can stay anchored to the viewport.
    result['--pc-design-attachment'] =
      styles.designBackground?.kind === 'image' && styles.designBackground.parallax === true
        ? 'scroll, fixed'
        : 'scroll';
    result['--pc-design-position'] =
      styles.designBackground?.kind === 'image' ? styles.designBackground.position : 'center';
    const bg = (value: PageStyleValues): string => {
      if (value.backgroundColor) return value.backgroundColor;
      switch (value.background) {
        case 'glass':
          return 'rgb(24 16 34 / 52%)';
        case 'solid':
          return '#282034';
        case 'accent':
          return 'rgb(218 139 185 / 16%)';
        default:
          return 'transparent';
      }
    };
    const base: PageStyleValues = {
      background: styles.background ?? PAGE_STYLE_DEFAULTS.background,
      backgroundColor: styles.backgroundColor,
      textColor: styles.textColor,
      padding: styles.padding ?? PAGE_STYLE_DEFAULTS.padding,
      gap: styles.gap ?? PAGE_STYLE_DEFAULTS.gap,
      radius: styles.radius ?? PAGE_STYLE_DEFAULTS.radius,
      align: styles.align ?? PAGE_STYLE_DEFAULTS.align,
    };
    const keys = ['padding', 'gap', 'radius', 'align', 'text-color', 'background-color'] as const;
    const css = (values: PageStyleValues, key: (typeof keys)[number]): string | undefined => {
      switch (key) {
        case 'padding':
          return values.padding === undefined ? undefined : `${values.padding}px`;
        case 'gap':
          return values.gap === undefined ? undefined : `${values.gap}px`;
        case 'radius':
          return values.radius === undefined ? undefined : `${values.radius}px`;
        case 'align':
          return values.align;
        case 'text-color':
          return values.textColor;
        case 'background-color':
          return values.background !== undefined || values.backgroundColor ? bg(values) : undefined;
      }
    };
    // Text color follows the nearest explicitly styled ancestor at each breakpoint.
    // The root establishes the same white default shown by the Composer inspector.
    Object.assign(result, pageTextColorVars(styles, isPage));
    for (const key of keys) {
      if (key === 'text-color') continue;
      result[`--pc-${key}`] = css(base, key) ?? 'inherit';
      result[`--pc-tablet-${key}`] =
        css(styles.responsive?.tablet ?? {}, key) ?? `var(--pc-${key})`;
      result[`--pc-mobile-${key}`] =
        css(styles.responsive?.mobile ?? {}, key) ?? `var(--pc-tablet-${key})`;
    }
    if (styles.spacing) {
      // A semantic spacing preset overrides old numeric values at every breakpoint.
      for (const key of ['--pc-padding', '--pc-tablet-padding', '--pc-mobile-padding'])
        result[key] = `var(--composer-section-${styles.spacing})`;
    }
    const box = (edges: PageStyleValues['paddingBox']): string | undefined =>
      edges ? `${edges.top}px ${edges.right}px ${edges.bottom}px ${edges.left}px` : undefined;
    // Explicit box values take precedence. Without them, preserve all legacy
    // desktop / tablet / mobile padding values and semantic spacing presets.
    result['--pc-box-padding'] = box(styles.paddingBox) ?? 'var(--pc-padding, 0px)';
    result['--pc-tablet-box-padding'] =
      box(styles.responsive?.tablet?.paddingBox) ??
      (styles.responsive?.tablet?.padding !== undefined && !styles.spacing
        ? 'var(--pc-tablet-padding)'
        : 'var(--pc-box-padding)');
    result['--pc-mobile-box-padding'] =
      box(styles.responsive?.mobile?.paddingBox) ??
      (styles.responsive?.mobile?.padding !== undefined && !styles.spacing
        ? 'var(--pc-mobile-padding)'
        : 'var(--pc-tablet-box-padding)');
    result['--pc-box-margin'] = box(styles.marginBox) ?? '0px';
    result['--pc-tablet-box-margin'] =
      box(styles.responsive?.tablet?.marginBox) ?? 'var(--pc-box-margin)';
    result['--pc-mobile-box-margin'] =
      box(styles.responsive?.mobile?.marginBox) ?? 'var(--pc-tablet-box-margin)';
    const inline = (edges: PageStyleValues['marginBox']): string | undefined =>
      edges ? `${edges.left}px ${edges.right}px` : undefined;
    // maxWidthContent keeps rows horizontally centered until custom margins are set.
    result['--pc-row-inline'] = inline(styles.marginBox) ?? 'auto';
    result['--pc-tablet-row-inline'] =
      inline(styles.responsive?.tablet?.marginBox) ?? 'var(--pc-row-inline)';
    result['--pc-mobile-row-inline'] =
      inline(styles.responsive?.mobile?.marginBox) ?? 'var(--pc-tablet-row-inline)';
    return result;
  }

  private backgroundImage(value: ComposerBackground): string {
    if (value.kind === 'color') return 'none';
    if (value.kind === 'gradient')
      return value.shape === 'radial'
        ? `radial-gradient(circle at center, ${value.from} 0%, ${value.to} 100%)`
        : `linear-gradient(${value.angle}deg, ${value.from}, ${value.to})`;
    const shade =
      value.overlay === 'strong'
        ? 'rgb(15 10 25 / 62%)'
        : value.overlay === 'soft'
          ? 'rgb(15 10 25 / 30%)'
          : 'transparent';
    const asset = this.imageSources.url(value.assetId, 1920);
    return `linear-gradient(${shade}, ${shade}), url("${asset}")`;
  }
}
