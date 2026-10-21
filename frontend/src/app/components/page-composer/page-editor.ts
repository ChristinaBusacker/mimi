import type { Asset } from '@shared/assets/asset';
import type { AlbumBookletContext } from '@shared/content/album-booklet-context';
import type {
  PageAlbumPalette,
  PageBlock,
  ComposerSpacing,
  ComposerCorners,
  ComposerBoxEdges,
  PageColumn,
  PageDocument,
  PageNode,
  PageRow,
  PageSection,
  PageStyles,
  RowLayout,
} from '@shared/content/page-document';
import { PAGE_ROW_LAYOUTS, PAGE_ROW_OPTIONS } from '@shared/content/page-layouts';
import { ComposerColorPicker } from './composer-color-picker';
import { ComposerBoxControl } from './composer-box-control';
import { AsyncPipe } from '@angular/common';
import { ElementRef, HostListener, afterNextRender, viewChild } from '@angular/core';
import { AssetLibrary } from '../asset-library/asset-library';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  output,
  signal,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Icon } from '../icon/icon';
import { MarkdownEditor } from '../markdown-editor/markdown-editor';
import { I18nPipe } from '../../core/i18n/i18n.pipe';
import { PageRenderer } from './page-renderer';
import type { CanvasInsert, CanvasMove, CanvasSelection } from './page-renderer';
import { pageGridColumns } from '../../../helpers/pageGridColumns.helper';
import type { PageStyleValues } from '@shared/content/page-document';
import { insertPageItem, movePageItem } from './page-editor-operations';
import { collectBookletColors } from './page-document-colors';

type Selection = { kind: 'page' | 'section' | 'row' | 'column' | 'block'; id: string };
type BlockKind = PageBlock['type'];
type CornerKey = keyof ComposerCorners;
type CornerLink = 'all' | 'top' | 'right' | 'bottom' | 'left';
type ShadowPreset = 'none' | 'soft' | 'card' | 'floating' | 'deep' | 'glow';
const CORNER_PAIRS: Record<Exclude<CornerLink, 'all'>, readonly [CornerKey, CornerKey]> = {
  top: ['topLeft', 'topRight'],
  right: ['topRight', 'bottomRight'],
  bottom: ['bottomLeft', 'bottomRight'],
  left: ['topLeft', 'bottomLeft'],
};
const SHADOW_PRESETS: Record<ShadowPreset, PageStyles['shadow'] | undefined> = {
  none: undefined,
  soft: { x: 0, y: 3, blur: 12, spread: 0, color: '#0502012b' },
  card: { x: 0, y: 7, blur: 22, spread: 0, color: '#0502014a' },
  floating: { x: 0, y: 16, blur: 36, spread: 0, color: '#05020170' },
  deep: { x: 0, y: 24, blur: 45, spread: 0, color: '#050201a0' },
  glow: { x: 0, y: 0, blur: 25, spread: 0, color: '#da8dbbbf' },
};
const initialStyles = (): PageStyles => ({
  background: 'none',
  padding: 0,
  gap: 16,
  radius: 0,
  align: 'left',
});
const node = (): PageNode => ({ id: crypto.randomUUID(), styles: initialStyles() });
const makeColumn = (): PageColumn => ({
  ...node(),
  contentAlign: 'start',
  styles: { ...initialStyles(), spacing: 'small' },
  blocks: [],
});
const mediumPadding = () => ({ top: 16, right: 16, bottom: 16, left: 16 });
const makeRow = (layout: RowLayout): PageRow => ({
  ...node(),
  styles: { ...initialStyles(), paddingBox: mediumPadding() },
  layout,
  columns: PAGE_ROW_LAYOUTS[layout].map(() => makeColumn()),
});
const makeSection = (): PageSection => ({
  ...node(),
  styles: { ...initialStyles(), paddingBox: mediumPadding() },
  rows: [makeRow('1')],
});
const makeBlock = (kind: BlockKind): PageBlock => {
  const base = node();
  switch (kind) {
    case 'text':
      return { ...base, type: kind, markdown: { de: '', en: '' } };
    case 'image':
      return { ...base, type: kind, assetId: null, alt: { de: '', en: '' } };
    case 'gallery':
      return { ...base, type: kind, layout: 'auto', items: [] };
    case 'slider':
      return { ...base, type: kind, items: [], perView: 1.5, showBullets: false };
    case 'cardCarousel':
      return { ...base, type: kind, items: [] };
    case 'spacer':
      return { ...base, type: kind, height: 48 };
    case 'albumDetails':
      return { ...base, type: kind };
    case 'albumTracks':
      return { ...base, type: kind };
    case 'albumCredits':
      return { ...base, type: kind, heading: { de: 'Mitwirkende', en: 'Credits' }, entries: [] };
  }
};

@Component({
  selector: 'app-page-editor',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AsyncPipe,
    I18nPipe,
    Icon,
    MarkdownEditor,
    PageRenderer,
    ComposerColorPicker,
    ComposerBoxControl,
    ReactiveFormsModule,
    AssetLibrary,
  ],
  templateUrl: './page-editor.html',
  styleUrl: './page-editor.scss',
})
export class PageEditor {
  readonly album = input<AlbumBookletContext | null>(null);
  readonly document = input.required<PageDocument>();
  protected readonly bookletColors = computed(() => collectBookletColors(this.document()));
  readonly assets = input<readonly Asset[]>([]);
  readonly coverAssetId = input<string | null>(null);
  protected readonly coverUrl = computed(() => {
    const id = this.coverAssetId();
    return id ? `url("/api/assets/${encodeURIComponent(id)}/image/large/fallback")` : 'none';
  });
  readonly documentChange = output<PageDocument>();
  /** Request persistence from the parent; the editor never saves directly. */
  readonly saveRequest = output<boolean>();

  private readonly workspace = viewChild<ElementRef<HTMLElement>>('workspace');
  private readonly imageLibrary = viewChild(AssetLibrary);
  private readonly defaultInspectorWidth = 380;
  private resizing: number | null = null;
  protected readonly inspectorWidth = signal(this.defaultInspectorWidth);
  protected readonly inspectorOpen = signal(true);
  protected readonly fullscreen = signal(false);
  protected toggleFullscreen(): void {
    this.fullscreen.update((value) => !value);
  }
  @HostListener('document:keydown.escape')
  protected closeFullscreenOnEscape(): void {
    if (this.fullscreen()) this.fullscreen.set(false);
  }
  protected readonly mediaTarget = signal<string | null>(null);
  protected readonly galleryTarget = signal<string | null>(null);
  protected readonly backgroundTarget = signal<string | null>(null);
  protected readonly breadcrumbs = computed((): Selection[] => {
    const selected = this.selected();
    const page = this.document();
    const path: Selection[] = [{ kind: 'page', id: page.id }];
    if (!selected || selected.kind === 'page') return path;
    for (const section of page.sections) {
      const sectionPath: Selection[] = [...path, { kind: 'section', id: section.id }];
      if (selected.kind === 'section' && selected.id === section.id) return sectionPath;
      for (const row of section.rows) {
        const rowPath: Selection[] = [...sectionPath, { kind: 'row', id: row.id }];
        if (selected.kind === 'row' && selected.id === row.id) return rowPath;
        for (const column of row.columns) {
          const columnPath: Selection[] = [...rowPath, { kind: 'column', id: column.id }];
          if (selected.kind === 'column' && selected.id === column.id) return columnPath;
          if (selected.kind === 'block' && column.blocks.some((block) => block.id === selected.id))
            return [...columnPath, selected];
        }
      }
    }
    return path;
  });

  protected pathLabel(selection: Selection): string {
    const page = this.document();
    switch (selection.kind) {
      case 'page':
        return 'page.editor.title';
      case 'section':
        return 'page.editor.section';
      case 'row':
        return 'page.editor.row';
      case 'column':
        return 'page.editor.column';
      case 'block': {
        const block = this.find(page, selection);
        return block && 'type' in block ? this.blockName(block) : 'page.editor.content';
      }
    }
  }

  protected pathIndex(selection: Selection): number | null {
    if (selection.kind === 'page' || selection.kind === 'block') return null;
    const page = this.document();
    if (selection.kind === 'section')
      return page.sections.findIndex((item) => item.id === selection.id) + 1;
    for (const section of page.sections) {
      if (selection.kind === 'row') {
        const index = section.rows.findIndex((item) => item.id === selection.id);
        if (index >= 0) return index + 1;
      }
      for (const row of section.rows) {
        const index = row.columns.findIndex((item) => item.id === selection.id);
        if (selection.kind === 'column' && index >= 0) return index + 1;
      }
    }
    return null;
  }

  protected beginResize(event: PointerEvent): void {
    if (!event.isPrimary || event.button !== 0) return;
    const handle = event.currentTarget;
    if (!(handle instanceof HTMLElement)) return;
    event.preventDefault();
    handle.setPointerCapture(event.pointerId);
    this.resizing = event.pointerId;
  }

  protected resize(event: PointerEvent): void {
    if (this.resizing !== event.pointerId) return;
    const bounds = this.workspace()?.nativeElement.getBoundingClientRect();
    if (!bounds) return;
    this.inspectorWidth.set(this.clampInspector(bounds.right - event.clientX));
  }

  protected finishResize(event: PointerEvent): void {
    if (this.resizing !== event.pointerId) return;
    this.resizing = null;
    const handle = event.currentTarget;
    if (handle instanceof HTMLElement && handle.hasPointerCapture(event.pointerId))
      handle.releasePointerCapture(event.pointerId);
    this.persistInspector();
  }

  protected resizeKeyboard(event: KeyboardEvent): void {
    const delta = event.shiftKey ? 40 : 16;
    switch (event.key) {
      case 'ArrowLeft':
        this.inspectorWidth.set(this.clampInspector(this.inspectorWidth() + delta));
        break;
      case 'ArrowRight':
        this.inspectorWidth.set(this.clampInspector(this.inspectorWidth() - delta));
        break;
      case 'Home':
        this.inspectorWidth.set(300);
        break;
      case 'End':
        this.inspectorWidth.set(this.clampInspector(800));
        break;
      default:
        return;
    }
    event.preventDefault();
    this.persistInspector();
  }

  protected resetInspector(): void {
    this.inspectorWidth.set(this.clampInspector(this.defaultInspectorWidth));
    this.persistInspector();
  }

  private clampInspector(width: number): number {
    const available = this.workspace()?.nativeElement.getBoundingClientRect().width ?? 1400;
    const outline = this.outlineOpen() ? 215 : 0;
    return Math.round(Math.max(300, Math.min(800, available - outline - 320, width)));
  }

  private persistInspector(): void {
    try {
      localStorage.setItem('mimi.pageComposer.inspectorWidth', String(this.inspectorWidth()));
    } catch {
      /* Storage is optional. */
    }
  }

  protected selectedImageId(): string | null {
    const block = this.selectedBlock();
    return block?.type === 'image' ? block.assetId : null;
  }

  protected async openImageLibrary(id: string): Promise<void> {
    const node = this.find(this.document(), { kind: 'block', id });
    if (!node || !('type' in node) || node.type !== 'image') return;
    this.backgroundTarget.set(null);
    this.mediaTarget.set(id);
    this.inspect('block', id);
    await this.imageLibrary()?.open();
  }

  protected async openGalleryLibrary(id: string): Promise<void> {
    const node = this.find(this.document(), { kind: 'block', id });
    if (!node || !('type' in node) || (node.type !== 'gallery' && node.type !== 'slider')) return;
    this.backgroundTarget.set(null);
    this.mediaTarget.set(null);
    this.galleryTarget.set(id);
    this.inspect('block', id);
    await this.imageLibrary()?.open();
  }

  protected appendGalleryAssets(assets: Asset[]): void {
    const id = this.galleryTarget();
    this.galleryTarget.set(null);
    if (!id || !assets.length) return;
    this.changeNode({ kind: 'block', id }, (node) => {
      if (!('type' in node) || (node.type !== 'gallery' && node.type !== 'slider')) return;
      const existing = new Set(node.items.map((item) => item.assetId));
      for (const asset of assets) {
        if (node.items.length >= 36) break;
        if (existing.has(asset.id)) continue;
        existing.add(asset.id);
        node.items.push({
          id: crypto.randomUUID(),
          assetId: asset.id,
          alt: { de: asset.descriptionDe ?? '', en: asset.descriptionEn ?? '' },
        });
      }
    });
  }

  protected async openBackgroundLibrary(): Promise<void> {
    const selection = this.selected();
    if (selection?.kind !== 'section' && selection?.kind !== 'column') return;
    this.mediaTarget.set(null);
    this.backgroundTarget.set(selection.id);
    await this.imageLibrary()?.open();
  }

  protected chooseAsset(asset: Asset): void {
    const background = this.backgroundTarget();
    this.backgroundTarget.set(null);
    if (background) {
      const selection = this.selected();
      if (
        !selection ||
        selection.id !== background ||
        (selection.kind !== 'section' && selection.kind !== 'column')
      )
        return;
      this.changeSelected((node) => {
        node.styles.background = 'none';
        delete node.styles.backgroundColor;
        node.styles.designBackground = {
          kind: 'image',
          assetId: asset.id,
          position: 'center',
          overlay: 'soft',
        };
      });
      return;
    }
    const id = this.mediaTarget();
    this.mediaTarget.set(null);
    if (!id) return;
    this.changeNode({ kind: 'block', id }, (node) => {
      if ('type' in node && node.type === 'image') {
        node.assetId = asset.id;
        if (!node.alt.de) node.alt.de = asset.descriptionDe ?? '';
        if (!node.alt.en) node.alt.en = asset.descriptionEn ?? '';
      }
    });
  }

  protected backgroundAssetId(): string | null {
    const design = this.active()?.styles.designBackground;
    return design?.kind === 'image' ? design.assetId : null;
  }

  protected backgroundValue(
    field: 'color' | 'from' | 'to' | 'angle' | 'position' | 'overlay',
  ): string {
    const design = this.active()?.styles.designBackground;
    if (!design) return '';
    if (design.kind === 'color') return field === 'color' ? design.color.slice(0, 7) : '';
    if (design.kind === 'gradient') {
      if (field === 'from') return design.from.slice(0, 7);
      if (field === 'to') return design.to.slice(0, 7);
      return field === 'angle' ? String(design.angle) : '';
    }
    return field === 'position' ? design.position : field === 'overlay' ? design.overlay : '';
  }

  protected backgroundOpacity(field: 'color' | 'from' | 'to'): number {
    const design = this.active()?.styles.designBackground;
    const color =
      design?.kind === 'color' && field === 'color'
        ? design.color
        : design?.kind === 'gradient' && field === 'from'
          ? design.from
          : design?.kind === 'gradient' && field === 'to'
            ? design.to
            : '#000000ff';
    return this.opacity(color);
  }

  protected changeBackgroundOpacity(field: 'color' | 'from' | 'to', event: Event): void {
    const alpha = this.alpha(this.value(event));
    this.changeSelected((node) => {
      const design = node.styles.designBackground;
      if (design?.kind === 'color' && field === 'color')
        design.color = this.withOpacity(design.color, alpha);
      if (design?.kind === 'gradient' && field === 'from')
        design.from = this.withOpacity(design.from, alpha);
      if (design?.kind === 'gradient' && field === 'to')
        design.to = this.withOpacity(design.to, alpha);
    });
  }

  protected opacity(hex: string): number {
    return hex.length === 9 ? Math.round((parseInt(hex.slice(7), 16) / 255) * 100) : 100;
  }
  private alpha(value: string): number {
    return Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
  }
  private withOpacity(color: string, alpha: number): string {
    return `${color.slice(0, 7)}${Math.round((alpha / 100) * 255)
      .toString(16)
      .padStart(2, '0')}`;
  }
  protected readonly cornerKeys: readonly CornerKey[] = [
    'topLeft',
    'topRight',
    'bottomLeft',
    'bottomRight',
  ];
  protected readonly cornerLinkKeys: readonly CornerLink[] = [
    'all',
    'top',
    'right',
    'bottom',
    'left',
  ];
  protected readonly cornerLinks = signal<ReadonlySet<CornerLink>>(new Set());
  protected cornerValue(key: CornerKey): number {
    return this.active()?.styles.corners?.[key] ?? this.active()?.styles.radius ?? 0;
  }
  private linkedCorners(key: CornerKey, links: ReadonlySet<CornerLink>): Set<CornerKey> {
    if (links.has('all')) return new Set(this.cornerKeys);
    const group = new Set<CornerKey>([key]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const side of ['top', 'right', 'bottom', 'left'] as const) {
        if (!links.has(side)) continue;
        const [a, b] = CORNER_PAIRS[side];
        if (group.has(a) !== group.has(b)) {
          group.add(a);
          group.add(b);
          changed = true;
        }
      }
    }
    return group;
  }
  protected setCorner(key: CornerKey, event: Event): void {
    const value = Math.min(160, Math.max(0, Number(this.value(event)) || 0));
    const linked = this.linkedCorners(key, this.cornerLinks());
    this.changeSelected((node) => {
      const uniform = node.styles.radius ?? 0;
      const corners = {
        topLeft: uniform,
        topRight: uniform,
        bottomRight: uniform,
        bottomLeft: uniform,
        ...node.styles.corners,
      };
      for (const corner of linked) corners[corner] = value;
      node.styles.corners = corners;
    });
  }
  protected toggleCornerLock(link: CornerLink): void {
    const next = new Set(this.cornerLinks());
    if (next.has(link)) next.delete(link);
    else if (link === 'all') {
      next.clear();
      next.add('all');
    } else {
      next.delete('all');
      next.add(link);
    }
    this.cornerLinks.set(next);
    if (!next.has(link)) return;
    const anchor: CornerKey = link === 'all' ? 'topLeft' : CORNER_PAIRS[link][0];
    const linked = this.linkedCorners(anchor, next);
    const value = this.cornerValue(anchor);
    this.changeSelected((node) => {
      const uniform = node.styles.radius ?? 0;
      const corners = {
        topLeft: uniform,
        topRight: uniform,
        bottomRight: uniform,
        bottomLeft: uniform,
        ...node.styles.corners,
      };
      for (const corner of linked) corners[corner] = value;
      node.styles.corners = corners;
    });
  }
  protected setBorderEnabled(event: Event): void {
    const enabled = (event.target as HTMLInputElement).checked;
    this.changeSelected((node) => {
      if (enabled) node.styles.border = { width: 1, style: 'solid', color: '#ecadd0c0' };
      else delete node.styles.border;
    });
  }
  protected setBorderNumber(event: Event): void {
    const value = Math.min(12, Math.max(0, Number(this.value(event)) || 0));
    this.changeSelected((node) => {
      if (node.styles.border) node.styles.border.width = value;
    });
  }
  protected setBorderStyle(event: Event): void {
    const value = this.value(event);
    if (value !== 'solid' && value !== 'dashed' && value !== 'dotted') return;
    this.changeSelected((node) => {
      if (node.styles.border) node.styles.border.style = value;
    });
  }
  protected setBorderColor(value: string): void {
    this.changeSurfaceColor('border', value);
  }
  protected setShadowColor(value: string): void {
    this.changeSurfaceColor('shadow', value);
  }
  protected setSurfaceOpacity(kind: 'border' | 'shadow', event: Event): void {
    const alpha = this.alpha(this.value(event));
    this.changeSelected((node) => {
      const style = node.styles[kind];
      if (style) style.color = this.withOpacity(style.color, alpha);
    });
  }
  private changeSurfaceColor(kind: 'border' | 'shadow', color: string): void {
    if (!/^#[0-9a-f]{8}$/i.test(color)) return;
    this.changeSelected((node) => {
      const style = node.styles[kind];
      if (style) style.color = color.toLowerCase();
    });
  }
  protected setBackgroundColor(field: 'color' | 'from' | 'to', color: string): void {
    if (!/^#[0-9a-f]{8}$/i.test(color)) return;
    this.changeSelected((node) => {
      const design = node.styles.designBackground;
      if (design?.kind === 'color' && field === 'color') design.color = color.toLowerCase();
      if (design?.kind === 'gradient' && field === 'from') design.from = color.toLowerCase();
      if (design?.kind === 'gradient' && field === 'to') design.to = color.toLowerCase();
    });
  }
  protected textColor(): string {
    return this.selectedBlock()?.styles.textColor ?? '#ffffffff';
  }
  protected headingColor(): string {
    const styles = this.selectedBlock()?.styles;
    return styles?.headingColor ?? styles?.textColor ?? '#ffffffff';
  }
  protected setHeadingColor(color: string): void {
    if (!/^#[0-9a-f]{8}$/i.test(color)) return;
    this.changeSelected((node) => {
      if ('type' in node && node.type === 'text') node.styles.headingColor = color.toLowerCase();
    });
  }
  protected resetHeadingColor(): void {
    this.changeSelected((node) => {
      if ('type' in node && node.type === 'text') delete node.styles.headingColor;
    });
  }
  protected boxValue(kind: 'paddingBox' | 'marginBox'): ComposerBoxEdges | null {
    const node = this.active();
    if (!node) return null;
    const device = this.breakpoint();
    const source = device === 'desktop' ? node.styles : node.styles.responsive?.[device];
    return source?.[kind] ?? null;
  }
  protected setBoxValue(kind: 'paddingBox' | 'marginBox', value: ComposerBoxEdges | null): void {
    const device = this.breakpoint();
    this.changeSelected((node) => {
      const target: PageStyleValues =
        device === 'desktop' ? node.styles : ((node.styles.responsive ??= {})[device] ??= {});
      if (value === null) delete target[kind];
      else target[kind] = { ...value };
    });
  }
  protected setTextColor(color: string): void {
    if (!/^#[0-9a-f]{8}$/i.test(color)) return;
    this.changeSelected((node) => {
      if ('type' in node && node.type === 'text') node.styles.textColor = color;
    });
  }
  protected resetTextColor(): void {
    this.changeSelected((node) => {
      if ('type' in node && node.type === 'text') delete node.styles.textColor;
    });
  }
  protected setTextShadow(event: Event): void {
    const value = this.value(event);
    if (!['none', 'readability', 'strong'].includes(value)) return;
    this.changeSelected((node) => {
      if ('type' in node && node.type === 'text')
        node.styles.textShadow = value as 'none' | 'readability' | 'strong';
    });
  }
  protected setShadowEnabled(event: Event): void {
    const enabled = (event.target as HTMLInputElement).checked;
    this.changeSelected((node) => {
      if (enabled) node.styles.shadow = { x: 0, y: 12, blur: 28, spread: 0, color: '#10061466' };
      else delete node.styles.shadow;
    });
  }
  protected setShadowNumber(field: 'x' | 'y' | 'blur' | 'spread', event: Event): void {
    const n = Number(this.value(event)) || 0;
    const value = field === 'blur' ? Math.max(0, Math.min(160, n)) : Math.max(-96, Math.min(96, n));
    this.changeSelected((node) => {
      if (node.styles.shadow) node.styles.shadow[field] = value;
    });
  }
  protected readonly shadowPresets: readonly ShadowPreset[] = [
    'none',
    'soft',
    'card',
    'floating',
    'deep',
    'glow',
  ];
  protected shadowPreset(): ShadowPreset | 'custom' {
    const value = this.active()?.styles.shadow;
    if (!value) return 'none';
    for (const preset of this.shadowPresets) {
      const candidate = SHADOW_PRESETS[preset];
      if (
        candidate &&
        (Object.keys(candidate) as (keyof NonNullable<typeof candidate>)[]).every(
          (key) => value[key] === candidate[key],
        )
      )
        return preset;
    }
    return 'custom';
  }
  protected shadowPreview(preset: ShadowPreset): string {
    const s = SHADOW_PRESETS[preset];
    return s ? `${s.x}px ${s.y}px ${s.blur}px ${s.spread}px ${s.color}` : 'none';
  }
  protected applyShadowPreset(preset: ShadowPreset): void {
    this.changeSelected((node) => {
      const value = SHADOW_PRESETS[preset];
      if (value) node.styles.shadow = { ...value };
      else delete node.styles.shadow;
    });
  }
  protected applySurfacePreset(name: 'none' | 'soft' | 'card' | 'floating' | 'glow'): void {
    this.changeSelected((node) => {
      delete node.styles.corners;
      delete node.styles.border;
      delete node.styles.shadow;
      if (name === 'none') {
        delete node.styles.designBackground;
        delete node.styles.backgroundColor;
        node.styles.background = 'none';
        node.styles.radius = 0;
        return;
      }
      node.styles.background = 'none';
      const radius = name === 'soft' ? 12 : name === 'card' ? 18 : name === 'floating' ? 24 : 20;
      node.styles.corners = {
        topLeft: radius,
        topRight: radius,
        bottomRight: radius,
        bottomLeft: radius,
      };
      node.styles.designBackground = {
        kind: 'color',
        color: name === 'glow' ? '#da8dbb28' : '#33223d99',
      };
      if (name !== 'soft') node.styles.border = { width: 1, style: 'solid', color: '#eca9d255' };
      if (name === 'floating')
        node.styles.shadow = { x: 0, y: 16, blur: 40, spread: 0, color: '#09030b88' };
      if (name === 'glow')
        node.styles.shadow = { x: 0, y: 0, blur: 28, spread: 1, color: '#ed93df77' };
    });
  }

  protected setSpacing(event: Event): void {
    const value = this.value(event);
    if (value !== '' && !['small', 'standard', 'large'].includes(value)) return;
    const selection = this.selected();
    if (selection?.kind !== 'section' && selection?.kind !== 'column') return;
    this.changeSelected((node) => {
      if (!value) delete node.styles.spacing;
      else {
        node.styles.spacing = value as ComposerSpacing;
        // Switching to a legacy preset should actually update the visible padding.
        delete node.styles.paddingBox;
      }
    });
  }

  protected setBackgroundMode(event: Event): void {
    const kind = this.value(event);
    if (kind === 'image') {
      void this.openBackgroundLibrary();
      return;
    }
    if (!['none', 'color', 'gradient'].includes(kind)) return;
    const selection = this.selected();
    if (selection?.kind !== 'section' && selection?.kind !== 'column' && selection?.kind !== 'row')
      return;
    this.changeSelected((node) => {
      node.styles.background = 'none';
      delete node.styles.backgroundColor;
      if (kind === 'none') delete node.styles.designBackground;
      else if (kind === 'color') node.styles.designBackground = { kind, color: '#35273f' };
      else
        node.styles.designBackground = {
          kind: 'gradient',
          from: '#875772',
          to: '#30243e',
          angle: 135,
        };
    });
  }

  // RGB and opacity now update together through ComposerColorPicker.

  protected setGradientShape(event: Event): void {
    const shape = this.value(event);
    if (shape !== 'linear' && shape !== 'radial') return;
    this.changeSelected((node) => {
      const design = node.styles.designBackground;
      if (design?.kind === 'gradient') design.shape = shape;
    });
  }
  protected setGradientAngle(event: Event): void {
    const angle = Number(this.value(event));
    if (![0, 45, 90, 135, 180].includes(angle)) return;
    this.changeSelected((node) => {
      const design = node.styles.designBackground;
      if (design?.kind === 'gradient') design.angle = angle as 0 | 45 | 90 | 135 | 180;
    });
  }

  protected setBackgroundParallax(event: Event): void {
    const enabled = (event.target as HTMLInputElement).checked;
    this.changeSelected((node) => {
      const design = node.styles.designBackground;
      if (design?.kind === 'image') design.parallax = enabled;
    });
  }
  protected changeBackgroundImage(field: 'position' | 'overlay', event: Event): void {
    const value = this.value(event);
    this.changeSelected((node) => {
      const design = node.styles.designBackground;
      if (design?.kind !== 'image') return;
      if (field === 'position' && ['top', 'center', 'bottom'].includes(value))
        design.position = value as 'top' | 'center' | 'bottom';
      if (field === 'overlay' && ['none', 'soft', 'strong'].includes(value))
        design.overlay = value as 'none' | 'soft' | 'strong';
    });
  }

  protected readonly layouts = PAGE_ROW_OPTIONS;
  protected readonly locale = signal<'de' | 'en'>('de');
  protected readonly preview = signal(false);
  protected readonly outlineOpen = signal(false);
  protected readonly addTarget = signal<CanvasInsert | null>(null);
  protected readonly inlineTextId = signal<string | null>(null);
  protected readonly blockKinds: readonly BlockKind[] = [
    'text',
    'image',
    'gallery',
    'slider',
    'cardCarousel',
    'spacer',
    'albumDetails',
    'albumTracks',
    'albumCredits',
  ];
  protected readonly device = signal<'desktop' | 'tablet' | 'mobile'>('desktop');
  protected readonly inspectorTab = signal<'content' | 'design' | 'advanced'>('content');
  protected readonly breakpoint = signal<'desktop' | 'tablet' | 'mobile'>('desktop');
  protected readonly undoAvailable = signal(false);
  protected readonly redoAvailable = signal(false);
  private readonly past: PageDocument[] = [];
  private readonly future: PageDocument[] = [];
  private lastHistoryKey: string | null = null;
  private lastHistoryTime = 0;
  protected readonly selected = signal<Selection | null>(null);
  protected readonly markdownControl = new FormControl('', { nonNullable: true });
  // A block's editor owns its current content while the user is editing it.
  // Replaying the document model into the control after each Tiptap update
  // resets the selection and interrupts image resize node views.
  private boundMarkdownKey: string | null = null;

  protected readonly active = computed(() => {
    const selection = this.selected();
    return selection ? this.find(this.document(), selection) : null;
  });

  protected readonly selectedBlock = computed(() => {
    const value = this.active();
    return value && 'type' in value ? value : null;
  });
  protected readonly selectedRow = computed(() => {
    const selection = this.selected();
    const value = this.active();
    return selection?.kind === 'row' && value && 'columns' in value ? value : null;
  });
  protected readonly selectedColumn = computed(() => {
    const value = this.active();
    return value && 'blocks' in value ? value : null;
  });

  constructor() {
    afterNextRender(() => {
      try {
        const stored = Number(localStorage.getItem('mimi.pageComposer.inspectorWidth'));
        if (Number.isFinite(stored) && stored >= 300)
          this.inspectorWidth.set(this.clampInspector(stored));
      } catch {
        /* Browser storage may be unavailable. */
      }
    });
    effect(() => {
      const selection = this.selected();
      const value = this.active();
      const locale = this.locale();
      const isText =
        selection?.kind === 'block' && value && 'type' in value && value.type === 'text';
      const key = isText ? `${selection.id}:${locale}` : null;
      const markdown = isText ? value.markdown[locale] : '';
      const switched = key !== this.boundMarkdownKey;
      if (switched) this.boundMarkdownKey = key;
      // New selection / locale: load its saved Markdown. While the editor is
      // dirty, its FormControl is authoritative; do not write an older model
      // echo back into it (setContent replaces the ProseMirror selection).
      if (switched || !this.markdownControl.dirty) {
        if (this.markdownControl.value !== markdown) {
          this.markdownControl.setValue(markdown, { emitEvent: false });
        }
        if (switched) this.markdownControl.markAsPristine();
      }
    });
    this.markdownControl.valueChanges.pipe(takeUntilDestroyed()).subscribe((markdown) => {
      const selection = this.selected();
      if (selection?.kind === 'block')
        this.changeNode(selection, (value) => {
          if ('type' in value && value.type === 'text') value.markdown[this.locale()] = markdown;
        });
    });
  }

  protected grid(layout: RowLayout): string {
    return pageGridColumns(layout);
  }
  protected isSelected(id: string): boolean {
    return this.selected()?.id === id;
  }
  protected inspect(kind: Selection['kind'], id: string): void {
    if (this.selected()?.id !== id) this.cornerLinks.set(new Set());
    const selection: Selection = { kind, id };
    const value = this.find(this.document(), selection);
    const text = kind === 'block' && value && 'type' in value && value.type === 'text';
    const key = text ? `${id}:${this.locale()}` : null;
    // Load the new value synchronously before Angular renders the inspector.
    // Crucially, do not rebind when the user reselects the SAME text block.
    if (key !== this.boundMarkdownKey) {
      this.boundMarkdownKey = key;
      const markdown = text ? value.markdown[this.locale()] : '';
      if (this.markdownControl.value !== markdown) {
        this.markdownControl.setValue(markdown, { emitEvent: false });
      }
      this.markdownControl.markAsPristine();
    }
    this.selected.set(selection);
    this.inspectorTab.set(kind === 'block' ? 'content' : 'design');
  }
  protected styleValue(
    styles: PageStyles,
    key: Exclude<keyof PageStyleValues, 'paddingBox' | 'marginBox'>,
  ): string | number {
    const view = this.breakpoint();
    const values = view === 'desktop' ? styles : styles.responsive?.[view];
    return values?.[key] ?? '';
  }
  protected selectDevice(device: 'desktop' | 'tablet' | 'mobile'): void {
    this.device.set(device);
    this.breakpoint.set(device);
  }

  protected togglePreview(): void {
    this.inlineTextId.set(null);
    this.addTarget.set(null);
    this.preview.set(!this.preview());
  }

  protected canvasSelect(selection: CanvasSelection): void {
    if (this.inlineTextId() !== selection.id) this.inlineTextId.set(null);
    this.inspect(selection.kind, selection.id);
  }

  protected canvasMove(move: CanvasMove): void {
    const next = movePageItem(this.document(), move.kind, move.id, move.parentId, move.index);
    if (next) {
      this.commit(next);
      this.inspect(move.kind, move.id);
    }
  }

  protected canvasInsert(target: CanvasInsert): void {
    if (target.kind === 'section') {
      this.addSection(target.index);
      return;
    }
    this.addTarget.set(target);
  }

  protected canvasAction(action: {
    kind: 'section' | 'row' | 'block';
    id: string;
    action: 'duplicate' | 'remove';
  }): void {
    if (action.action === 'duplicate') this.duplicate(action.kind, action.id);
    else this.remove(action.kind, action.id);
  }

  protected openInline(id: string): void {
    const next = this.inlineTextId() === id ? null : id;
    this.inspect('block', id);
    this.inlineTextId.set(next);
  }

  protected updateInline(value: { id: string; markdown: string }): void {
    this.changeNode({ kind: 'block', id: value.id }, (node) => {
      if ('type' in node && node.type === 'text') node.markdown[this.locale()] = value.markdown;
    });
  }

  protected insertLayout(parentId: string, layout: RowLayout, index: number): void {
    const row = makeRow(layout);
    const next = insertPageItem(this.document(), 'row', parentId, row, index);
    if (!next) return;
    this.commit(next);
    this.addTarget.set(null);
    this.inspect('row', row.id);
  }

  protected insertBlock(parentId: string, kind: BlockKind, index: number): void {
    this.addBlock(parentId, kind, index);
    this.addTarget.set(null);
    this.inlineTextId.set(null);
  }

  protected blockIcon(kind: BlockKind): string {
    switch (kind) {
      case 'text':
        return 'text';
      case 'image':
        return 'image';
      case 'gallery':
        return 'gallery';
      case 'slider':
        return 'image';
      case 'cardCarousel':
        return 'layout-template';
      case 'spacer':
        return 'spacer';
      case 'albumDetails':
        return 'music';
      case 'albumTracks':
        return 'list-numbered';
      case 'albumCredits':
        return 'community';
    }
  }

  protected undo(): void {
    const previous = this.past.pop();
    if (!previous) return;
    this.future.push(structuredClone(this.document()));
    this.lastHistoryKey = null;
    this.refreshHistory();
    this.documentChange.emit(previous);
  }
  protected redo(): void {
    const next = this.future.pop();
    if (!next) return;
    this.past.push(structuredClone(this.document()));
    this.lastHistoryKey = null;
    this.refreshHistory();
    this.documentChange.emit(next);
  }
  @HostListener('document:keydown', ['$event'])
  protected keyboard(event: KeyboardEvent): void {
    if (event.defaultPrevented) return;
    const key = event.key.toLowerCase();
    const modifier = event.ctrlKey || event.metaKey;
    if (modifier && !event.altKey && !event.shiftKey && key === 's') {
      event.preventDefault();
      this.saveRequest.emit(false);
      return;
    }

    const element = event.target;
    const editing =
      element instanceof HTMLElement &&
      Boolean(
        element.closest('input, textarea, select, [contenteditable="true"], .markdown-editor'),
      );
    // Escape dismisses the insertion menu or inline editing without modifying content.
    if (event.key === 'Escape' && !editing) {
      if (this.addTarget()) {
        event.preventDefault();
        this.addTarget.set(null);
      } else if (this.inlineTextId()) {
        event.preventDefault();
        this.inlineTextId.set(null);
      }
      return;
    }
    if (
      event.altKey &&
      !modifier &&
      !editing &&
      (event.key === 'ArrowUp' || event.key === 'ArrowDown')
    ) {
      const selected = this.selected();
      if (selected && selected.kind !== 'page' && selected.kind !== 'column') {
        event.preventDefault();
        this.shift(selected.kind, selected.id, event.key === 'ArrowUp' ? -1 : 1);
      }
      return;
    }
    // Native undo in text fields remains intact. Structural history works everywhere else.
    if (!modifier || event.altKey || editing) return;
    if (key === 'z') {
      event.preventDefault();
      if (event.shiftKey) this.redo();
      else this.undo();
    } else if (key === 'y' && !event.shiftKey) {
      event.preventDefault();
      this.redo();
    }
  }
  protected responsiveStyle(key: keyof PageStyleValues, event: Event): void {
    const raw = this.value(event);
    const breakpoint = this.breakpoint();
    this.changeSelected((node) => {
      const destination: PageStyleValues =
        breakpoint === 'desktop'
          ? node.styles
          : ((node.styles.responsive ??= {})[breakpoint] ??= {});
      if (raw === '' && breakpoint !== 'desktop') {
        delete destination[key];
        return;
      }
      if (key === 'background' && ['none', 'glass', 'solid', 'accent'].includes(raw))
        destination.background = raw as PageStyleValues['background'];
      if (key === 'align' && ['left', 'center', 'right'].includes(raw))
        destination.align = raw as PageStyleValues['align'];
      if ((key === 'backgroundColor' || key === 'textColor') && /^#[0-9a-f]{6}$/i.test(raw))
        destination[key] = raw.toLowerCase();
      if ((key === 'backgroundColor' || key === 'textColor') && raw === '') delete destination[key];
      if (key === 'padding' || key === 'radius' || key === 'gap') {
        const parsed = Number(raw);
        if (raw !== '' && Number.isFinite(parsed))
          destination[key] = Math.min(
            key === 'radius' ? 48 : key === 'gap' ? 64 : 96,
            Math.max(0, parsed),
          );
      }
    });
  }
  protected clearBreakpoint(): void {
    const breakpoint = this.breakpoint();
    if (breakpoint === 'desktop') return;
    this.changeSelected((node) => {
      if (node.styles.responsive) delete node.styles.responsive[breakpoint];
    });
  }
  protected addSection(index = this.document().sections.length): void {
    const section = makeSection();
    const next = insertPageItem(this.document(), 'section', this.document().id, section, index);
    if (!next) return;
    this.commit(next);
    this.inspect('section', section.id);
  }
  protected addBlock(columnId: string, type: BlockKind, index?: number): void {
    if (
      type === 'albumTracks' &&
      this.document().sections.some((section) =>
        section.rows.some((row) =>
          row.columns.some((column) => column.blocks.some((block) => block.type === 'albumTracks')),
        ),
      )
    )
      return;
    const block = makeBlock(type);
    const column = this.find(this.document(), { kind: 'column', id: columnId });
    if (!column || !('blocks' in column)) return;
    const next = insertPageItem(
      this.document(),
      'block',
      columnId,
      block,
      index ?? column.blocks.length,
    );
    if (!next) return;
    this.commit(next);
    this.inspect('block', block.id);
  }
  protected setGalleryLayout(event: Event): void {
    const layout = this.value(event);
    if (
      layout !== 'auto' &&
      layout !== 'grid' &&
      layout !== 'featured' &&
      layout !== 'featuredRight' &&
      layout !== 'panorama' &&
      layout !== 'mosaic'
    )
      return;
    this.changeSelected((node) => {
      if ('type' in node && node.type === 'gallery') node.layout = layout;
    });
  }
  protected setSliderPerView(event: Event): void {
    const value = Number(this.value(event));
    if (![1, 1.5, 2, 2.5, 3, 4].includes(value)) return;
    this.changeSelected((node) => {
      if ('type' in node && node.type === 'slider') node.perView = value;
    });
  }
  protected setSliderBullets(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.changeSelected((node) => {
      if ('type' in node && node.type === 'slider') node.showBullets = checked;
    });
  }
  protected albumPaletteColor(field: keyof PageAlbumPalette): string {
    const block = this.selectedBlock();
    if (!block || !['albumDetails', 'albumTracks', 'albumCredits'].includes(block.type)) return '#ffffffff';
    if ('palette' in block && block.palette?.[field]) return block.palette[field]!;
    if (field === 'backgroundColor') return '#140e2073';
    if (field === 'iconColor') return '#df9cbdff';
    if (field === 'subtitleColor') return '#e2c8dbff';
    return '#fff5faff';
  }
  protected albumPaletteSet(field: keyof PageAlbumPalette, color: string): void {
    if (!/^#[a-f0-9]{8}$/i.test(color)) return;
    this.changeSelected((node) => {
      if (!('type' in node) ||
          (node.type !== 'albumDetails' && node.type !== 'albumTracks' && node.type !== 'albumCredits')) return;
      if (node.type !== 'albumDetails' && (field === 'iconColor' || field === 'subtitleColor')) return;
      (node.palette ??= {})[field] = color.toLowerCase();
    });
  }
  protected albumPaletteReset(field: keyof PageAlbumPalette): void {
    this.changeSelected((node) => {
      if (!('type' in node) ||
          (node.type !== 'albumDetails' && node.type !== 'albumTracks' && node.type !== 'albumCredits')) return;
      if (node.palette) {
        delete node.palette[field];
        if (!Object.keys(node.palette).length) delete node.palette;
      }
    });
  }
  protected setColumnAlignment(event: Event): void {
    const contentAlign = this.value(event);
    if (contentAlign !== 'start' && contentAlign !== 'center' && contentAlign !== 'end') return;
    this.changeSelected((node) => {
      if ('blocks' in node) node.contentAlign = contentAlign;
    });
  }
  protected addGalleryImage(event: Event): void {
    const value = this.value(event);
    if (!value) return;
    this.changeSelected((node) => {
      if (
        'type' in node &&
        (node.type === 'gallery' || node.type === 'slider') &&
        node.items.length < 36
      ) {
        const asset = this.assets().find((item) => item.id === value);
        node.items.push({
          id: crypto.randomUUID(),
          assetId: value,
          alt: { de: asset?.descriptionDe ?? '', en: asset?.descriptionEn ?? '' },
        });
      }
    });
  }
  protected deleteGalleryImage(id: string): void {
    this.changeSelected((node) => {
      if ('type' in node && (node.type === 'gallery' || node.type === 'slider'))
        node.items = node.items.filter((item) => item.id !== id);
    });
  }
  protected moveGalleryImage(id: string, direction: -1 | 1): void {
    this.changeSelected((node) => {
      if (!('type' in node) || (node.type !== 'gallery' && node.type !== 'slider')) return;
      const index = node.items.findIndex((item) => item.id === id);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= node.items.length) return;
      [node.items[index], node.items[target]] = [node.items[target], node.items[index]];
    });
  }
  protected updateGalleryAlt(id: string, event: Event): void {
    const text = this.value(event);
    this.changeSelected((node) => {
      if ('type' in node && (node.type === 'gallery' || node.type === 'slider')) {
        const item = node.items.find((candidate) => candidate.id === id);
        if (item) item.alt[this.locale()] = text;
      }
    });
  }
  protected addCard(): void {
    this.changeSelected((node) => {
      if ('type' in node && node.type === 'cardCarousel' && node.items.length < 24) {
        node.items.push({
          id: crypto.randomUUID(),
          assetId: null,
          alt: { de: '', en: '' },
          title: { de: '', en: '' },
          description: { de: '', en: '' },
          href: '',
        });
      }
    });
  }
  protected removeCard(id: string): void {
    this.changeSelected((node) => {
      if ('type' in node && node.type === 'cardCarousel')
        node.items = node.items.filter((item) => item.id !== id);
    });
  }
  protected moveCard(id: string, direction: -1 | 1): void {
    this.changeSelected((node) => {
      if (!('type' in node) || node.type !== 'cardCarousel') return;
      const index = node.items.findIndex((item) => item.id === id);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= node.items.length) return;
      [node.items[index], node.items[target]] = [node.items[target], node.items[index]];
    });
  }
  protected editCard(
    id: string,
    field: 'assetId' | 'alt' | 'title' | 'description' | 'href',
    event: Event,
  ): void {
    const value = this.value(event);
    this.changeSelected((node) => {
      if (!('type' in node) || node.type !== 'cardCarousel') return;
      const card = node.items.find((item) => item.id === id);
      if (!card) return;
      if (field === 'assetId') card.assetId = value || null;
      else if (field === 'href') card.href = value.slice(0, 800);
      else {
        const max = field === 'description' ? 800 : field === 'title' ? 200 : 300;
        card[field][this.locale()] = value.slice(0, max);
      }
    });
  }
  protected updateImage(event: Event): void {
    const assetId = this.value(event) || null;
    this.changeSelected((node) => {
      if ('type' in node && node.type === 'image') node.assetId = assetId;
    });
  }
  protected updateAlt(event: Event): void {
    const text = this.value(event);
    this.changeSelected((node) => {
      if ('type' in node && node.type === 'image') node.alt[this.locale()] = text;
    });
  }
  protected updateSpacer(event: Event): void {
    const height = Number(this.value(event));
    if (!Number.isFinite(height)) return;
    this.changeSelected((node) => {
      if ('type' in node && node.type === 'spacer')
        node.height = Math.max(0, Math.min(240, height));
    });
  }
  protected chooseLayout(rowId: string, layout: RowLayout): void {
    this.changeNode({ kind: 'row', id: rowId }, (item) => {
      if (!('columns' in item)) return;
      const count = PAGE_ROW_LAYOUTS[layout].length;
      const old = item.columns;
      const columns = Array.from({ length: count }, (_, index) => old[index] ?? makeColumn());
      // Shrinking a row never discards content: overflow blocks join the last column.
      for (const extra of old.slice(count)) columns[count - 1].blocks.push(...extra.blocks);
      item.columns = columns;
      item.layout = layout;
    });
  }
  protected remove(kind: Selection['kind'], id: string): void {
    this.change((next) => {
      if (kind === 'section') {
        next.sections = next.sections.filter((item) => item.id !== id);
        return;
      }
      for (const section of next.sections) {
        if (kind === 'row') section.rows = section.rows.filter((item) => item.id !== id);
        for (const row of section.rows)
          for (const column of row.columns) {
            if (kind === 'block') column.blocks = column.blocks.filter((item) => item.id !== id);
          }
      }
      // Columns have a fixed count defined by their row layout and cannot be deleted separately.
    });
    if (this.selected()?.id === id) this.selected.set(null);
  }
  protected shift(kind: Selection['kind'], id: string, direction: -1 | 1): void {
    this.change((next) => {
      const collections: Array<Array<{ id: string }>> = [next.sections];
      for (const section of next.sections) {
        collections.push(section.rows);
        for (const row of section.rows)
          for (const column of row.columns) collections.push(column.blocks);
      }
      for (const collection of collections) {
        const index = collection.findIndex((item) => item.id === id);
        const target = index + direction;
        if (index < 0 || target < 0 || target >= collection.length) continue;
        [collection[index], collection[target]] = [collection[target], collection[index]];
        break;
      }
    });
  }
  protected duplicate(kind: Selection['kind'], id: string): void {
    this.change((next) => {
      const lists: Array<Array<PageSection | PageRow | PageBlock>> = [next.sections];
      for (const section of next.sections) {
        lists.push(section.rows);
        for (const row of section.rows) for (const column of row.columns) lists.push(column.blocks);
      }
      for (const list of lists) {
        const index = list.findIndex((item) => item.id === id);
        if (index < 0) continue;
        const duplicate = structuredClone(list[index]);
        const freshen = (value: PageSection | PageRow | PageColumn | PageBlock): void => {
          value.id = crypto.randomUUID();
          if ('rows' in value) value.rows.forEach(freshen);
          if ('columns' in value) value.columns.forEach(freshen);
          if ('blocks' in value) value.blocks.forEach(freshen);
          if (
            'type' in value &&
            (value.type === 'gallery' || value.type === 'slider' || value.type === 'cardCarousel')
          )
            for (const item of value.items) item.id = crypto.randomUUID();
        };
        freshen(duplicate);
        list.splice(index + 1, 0, duplicate);
        break;
      }
    });
  }
  protected blockName(block: PageBlock): string {
    return `page.editor.block.${block.type}`;
  }
  protected addCredit(): void {
    this.changeSelected((value) => {
      if ('type' in value && value.type === 'albumCredits' && value.entries.length < 40)
        value.entries.push({ name: '', role: { de: '', en: '' } });
    });
  }
  protected removeCredit(index: number): void {
    this.changeSelected((value) => {
      if ('type' in value && value.type === 'albumCredits') value.entries.splice(index, 1);
    });
  }
  protected editCredit(index: number, field: 'name' | 'role', event: Event): void {
    const text = this.value(event);
    this.changeSelected((value) => {
      if (!('type' in value) || value.type !== 'albumCredits') return;
      const credit = value.entries[index];
      if (!credit) return;
      if (field === 'name') credit.name = text.slice(0, 120);
      else credit.role[this.locale()] = text;
    });
  }
  protected editCreditsHeading(event: Event): void {
    const text = this.value(event);
    this.changeSelected((value) => {
      if ('type' in value && value.type === 'albumCredits') value.heading[this.locale()] = text;
    });
  }
  protected imageUrl(id: string): string {
    return `/api/assets/${encodeURIComponent(id)}/image/thumbnail/webp`;
  }
  protected value(event: Event): string {
    const element = event.target;
    return element instanceof HTMLInputElement ||
      element instanceof HTMLSelectElement ||
      element instanceof HTMLTextAreaElement
      ? element.value
      : '';
  }

  private changeSelected(
    update: (node: PageDocument | PageSection | PageRow | PageColumn | PageBlock) => void,
  ): void {
    const selection = this.selected();
    if (selection) this.changeNode(selection, update);
  }
  private changeNode(
    selection: Selection,
    update: (node: PageDocument | PageSection | PageRow | PageColumn | PageBlock) => void,
  ): void {
    this.change((document) => {
      const value = this.find(document, selection);
      if (value) update(value);
    });
  }
  private change(update: (next: PageDocument) => void): void {
    const next = structuredClone(this.document());
    update(next);
    this.commit(next);
  }
  private commit(next: PageDocument): void {
    const current = this.document();
    if (JSON.stringify(current) === JSON.stringify(next)) return;
    const selection = this.selected();
    const selected = selection ? this.find(next, selection) : null;
    const historyKey =
      selection?.kind === 'block' && selected && 'type' in selected && selected.type === 'text'
        ? `${selection.id}:${this.locale()}`
        : null;
    const now = Date.now();
    if (!(historyKey && historyKey === this.lastHistoryKey && now - this.lastHistoryTime < 600)) {
      this.past.push(structuredClone(current));
      if (this.past.length > 50) this.past.shift();
    }
    this.lastHistoryKey = historyKey;
    this.lastHistoryTime = now;
    this.future.length = 0;
    this.refreshHistory();
    this.documentChange.emit(next);
  }
  private refreshHistory(): void {
    this.undoAvailable.set(this.past.length > 0);
    this.redoAvailable.set(this.future.length > 0);
  }

  private find(
    document: PageDocument,
    selection: Selection,
  ): PageDocument | PageSection | PageRow | PageColumn | PageBlock | null {
    if (selection.kind === 'page') return document;
    for (const section of document.sections) {
      if (selection.id === section.id && selection.kind === 'section') return section;
      for (const row of section.rows) {
        if (selection.id === row.id && selection.kind === 'row') return row;
        for (const column of row.columns) {
          if (selection.id === column.id && selection.kind === 'column') return column;
          const block = column.blocks.find((item) => item.id === selection.id);
          if (selection.kind === 'block' && block) return block;
        }
      }
    }
    return null;
  }
}
