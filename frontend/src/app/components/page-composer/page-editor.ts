import type { Asset } from '@shared/assets/asset';
import type {
  PageBlock,
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
import { pageGridColumns } from '../../../helpers/pageGridColumns.helper';

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
const makeColumn = (): PageColumn => ({ ...node(), blocks: [] });
const makeRow = (layout: RowLayout): PageRow => ({
  ...node(),
  layout,
  columns: PAGE_ROW_LAYOUTS[layout].map(() => makeColumn()),
});
const makeSection = (): PageSection => ({ ...node(), rows: [makeRow('1')] });
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
  imports: [AsyncPipe, I18nPipe, Icon, MarkdownEditor, PageRenderer, ReactiveFormsModule],
  templateUrl: './page-editor.html',
  styleUrl: './page-editor.scss',
})
export class PageEditor {
  readonly document = input.required<PageDocument>();
  readonly assets = input<readonly Asset[]>([]);
  readonly documentChange = output<PageDocument>();

  protected readonly layouts = PAGE_ROW_OPTIONS;
  protected readonly locale = signal<'de' | 'en'>('de');
  protected readonly preview = signal(false);
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
    effect(() => {
      const value = this.active();
      this.markdownControl.setValue(
        value && 'type' in value && value.type === 'text' ? value.markdown[this.locale()] : '',
        { emitEvent: false },
      );
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
  protected select(kind: Selection['kind'], id: string): void {
    this.selected.set({ kind, id });
  }
  protected isSelected(id: string): boolean {
    return this.selected()?.id === id;
  }
  protected addSection(): void {
    const next = structuredClone(this.document());
    const section = makeSection();
    next.sections.push(section);
    this.documentChange.emit(next);
    this.select('section', section.id);
  }
  protected addRow(sectionId: string, layout: RowLayout = '1'): void {
    this.change((next) => {
      const section = next.sections.find((item) => item.id === sectionId);
      if (section) section.rows.push(makeRow(layout));
    });
  }
  protected addBlock(columnId: string, type: BlockKind): void {
    const block = makeBlock(type);
    this.changeNode({ kind: 'column', id: columnId }, (value) => {
      if ('blocks' in value) value.blocks.push(block);
    });
    this.select('block', block.id);
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
  protected changeStyle(key: keyof PageStyles, event: Event): void {
    const raw = this.value(event);
    this.changeSelected((node) => {
      if (key === 'background' && ['none', 'glass', 'solid', 'accent'].includes(raw))
        node.styles.background = raw as PageStyles['background'];
      if (key === 'align' && ['left', 'center', 'right'].includes(raw))
        node.styles.align = raw as PageStyles['align'];
      if (key === 'padding' || key === 'radius' || key === 'gap') {
        const number = Number(raw);
        if (Number.isFinite(number))
          node.styles[key] = Math.min(
            key === 'radius' ? 48 : key === 'gap' ? 64 : 96,
            Math.max(0, number),
          );
      }
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
    this.documentChange.emit(next);
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
