import type { Asset } from '@shared/assets/asset';
import type {
  PageBlock,
  ComposerSpacing,
  PageColumn,
  PageDocument,
  PageNode,
  PageRow,
  PageSection,
  PageStyles,
  RowLayout,
} from '@shared/content/page-document';
import { PAGE_ROW_LAYOUTS, PAGE_ROW_OPTIONS } from '@shared/content/page-layouts';
import { AsyncPipe } from '@angular/common';
import { ElementRef, afterNextRender, viewChild } from '@angular/core';
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

type Selection = { kind: 'page' | 'section' | 'row' | 'column' | 'block'; id: string };
type BlockKind = PageBlock['type'];
const initialStyles = (): PageStyles => ({
  background: 'none',
  padding: 0,
  gap: 16,
  radius: 0,
  align: 'left',
});
const node = (): PageNode => ({ id: crypto.randomUUID(), styles: initialStyles() });
const makeColumn = (): PageColumn => ({ ...node(), styles: { ...initialStyles(), spacing: 'small' }, blocks: [] });
const makeRow = (layout: RowLayout): PageRow => ({
  ...node(),
  layout,
  columns: PAGE_ROW_LAYOUTS[layout].map(() => makeColumn()),
});
const makeSection = (): PageSection => ({ ...node(), styles: { ...initialStyles(), spacing: 'standard' }, rows: [makeRow('1')] });
const makeBlock = (kind: BlockKind): PageBlock => {
  const base = node();
  switch (kind) {
    case 'text':
      return { ...base, type: kind, markdown: { de: '', en: '' } };
    case 'image':
      return { ...base, type: kind, assetId: null, alt: { de: '', en: '' } };
    case 'gallery':
      return { ...base, type: kind, items: [] };
    case 'spacer':
      return { ...base, type: kind, height: 48 };
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
    ReactiveFormsModule,
    AssetLibrary,
  ],
  templateUrl: './page-editor.html',
  styleUrl: './page-editor.scss',
})
export class PageEditor {
  readonly document = input.required<PageDocument>();
  readonly assets = input<readonly Asset[]>([]);
  readonly coverAssetId = input<string | null>(null);
  protected readonly coverUrl = computed(() => {
    const id = this.coverAssetId();
    return id ? `url("/api/assets/${encodeURIComponent(id)}/image/large/fallback")` : 'none';
  });
  readonly documentChange = output<PageDocument>();

  private readonly workspace = viewChild<ElementRef<HTMLElement>>('workspace');
  private readonly imageLibrary = viewChild(AssetLibrary);
  private readonly defaultInspectorWidth = 380;
  private resizing: number | null = null;
  protected readonly inspectorWidth = signal(this.defaultInspectorWidth);
  protected readonly inspectorOpen = signal(true);
  protected readonly mediaTarget = signal<string | null>(null);
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
      if (!selection || selection.id !== background ||
          (selection.kind !== 'section' && selection.kind !== 'column')) return;
      this.changeSelected((node) => {
        node.styles.background = 'none';
        delete node.styles.backgroundColor;
        node.styles.designBackground = {
          kind: 'image', assetId: asset.id, position: 'center', overlay: 'soft',
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

  protected backgroundValue(field: 'color' | 'from' | 'to' | 'angle' | 'position' | 'overlay'): string {
    const design = this.active()?.styles.designBackground;
    if (!design) return '';
    if (design.kind === 'color') return field === 'color' ? design.color : '';
    if (design.kind === 'gradient') {
      if (field === 'from') return design.from;
      if (field === 'to') return design.to;
      return field === 'angle' ? String(design.angle) : '';
    }
    return field === 'position' ? design.position : field === 'overlay' ? design.overlay : '';
  }

  protected setSpacing(event: Event): void {
    const value = this.value(event);
    if (value !== '' && !['small', 'standard', 'large'].includes(value)) return;
    const selection = this.selected();
    if (selection?.kind !== 'section' && selection?.kind !== 'column') return;
    this.changeSelected((node) => {
      if (!value) delete node.styles.spacing;
      else node.styles.spacing = value as ComposerSpacing;
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
    if (selection?.kind !== 'section' && selection?.kind !== 'column') return;
    this.changeSelected((node) => {
      node.styles.background = 'none';
      delete node.styles.backgroundColor;
      if (kind === 'none') delete node.styles.designBackground;
      else if (kind === 'color') node.styles.designBackground = { kind, color: '#35273f' };
      else node.styles.designBackground = { kind: 'gradient', from: '#875772', to: '#30243e', angle: 135 };
    });
  }

  protected changeBackgroundColor(field: 'color' | 'from' | 'to', event: Event): void {
    const color = this.value(event);
    if (!/^#[0-9a-f]{6}$/i.test(color)) return;
    this.changeSelected((node) => {
      const design = node.styles.designBackground;
      if (design?.kind === 'color' && field === 'color') design.color = color.toLowerCase();
      if (design?.kind === 'gradient' && field === 'from') design.from = color.toLowerCase();
      if (design?.kind === 'gradient' && field === 'to') design.to = color.toLowerCase();
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
  protected readonly blockKinds: readonly BlockKind[] = ['text', 'image', 'gallery', 'spacer'];
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

  protected readonly active = computed(() => {
    const selection = this.selected();
    return selection ? this.find(this.document(), selection) : null;
  });

  protected readonly selectedBlock = computed(() => {
    const value = this.active();
    return value && 'type' in value ? value : null;
  });
  protected readonly selectedRow = computed(() => {
    const value = this.active();
    return value && 'layout' in value ? value : null;
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
      const value = this.active();
      const markdown =
        value && 'type' in value && value.type === 'text' ? value.markdown[this.locale()] : '';
      if (this.markdownControl.value !== markdown) {
        this.markdownControl.setValue(markdown, { emitEvent: false });
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
    this.selected.set({ kind, id });
    this.inspectorTab.set(kind === 'block' ? 'content' : 'design');
  }
  protected styleValue(styles: PageStyles, key: keyof PageStyleValues): string | number {
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
      case 'spacer':
        return 'gallery';
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
  protected keyboard(event: KeyboardEvent): void {
    if (
      event.altKey &&
      !event.ctrlKey &&
      !event.metaKey &&
      (event.key === 'ArrowUp' || event.key === 'ArrowDown')
    ) {
      const selected = this.selected();
      const target = event.target;
      if (
        selected &&
        selected.kind !== 'page' &&
        selected.kind !== 'column' &&
        !(
          target instanceof HTMLElement &&
          target.closest('input, textarea, select, [contenteditable="true"]')
        )
      ) {
        event.preventDefault();
        this.shift(selected.kind, selected.id, event.key === 'ArrowUp' ? -1 : 1);
      }
      return;
    }
    if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
    const element = event.target;
    if (
      element instanceof HTMLElement &&
      element.closest('input, textarea, [contenteditable="true"], .markdown-editor')
    )
      return;
    if (event.key.toLowerCase() === 'z') {
      event.preventDefault();
      if (event.shiftKey) this.redo();
      else this.undo();
    } else if (event.key.toLowerCase() === 'y') {
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
  protected addGalleryImage(event: Event): void {
    const value = this.value(event);
    if (!value) return;
    this.changeSelected((node) => {
      if ('type' in node && node.type === 'gallery') {
        node.items.push({ id: crypto.randomUUID(), assetId: value, alt: { de: '', en: '' } });
      }
    });
  }
  protected deleteGalleryImage(id: string): void {
    this.changeSelected((node) => {
      if ('type' in node && node.type === 'gallery')
        node.items = node.items.filter((item) => item.id !== id);
    });
  }
  protected updateGalleryAlt(id: string, event: Event): void {
    const text = this.value(event);
    this.changeSelected((node) => {
      if ('type' in node && node.type === 'gallery') {
        const item = node.items.find((candidate) => candidate.id === id);
        if (item) item.alt[this.locale()] = text;
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
          if ('type' in value && value.type === 'gallery')
            for (const image of value.items) image.id = crypto.randomUUID();
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
