import type { Asset } from '@shared/assets/asset';

import { AsyncPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  effect,
  input,
  output,
  ViewEncapsulation,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

import { I18nPipe } from '../../core/i18n/i18n.pipe';
import { MarkdownEditor } from '../markdown-editor/markdown-editor';

/** Loaded only for an actively edited text block; never rendered as public content. */
@Component({
  selector: 'app-page-inline-markdown',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [AsyncPipe, I18nPipe, MarkdownEditor, ReactiveFormsModule],
  template: `
    <div class="page-inline-markdown" (click)="$event.stopPropagation()"
      (keydown.escape)="$event.stopPropagation(); closeEditor.emit()">
      <div class="page-inline-markdown__header">
        <strong>{{ 'page.editor.block.text' | i18n | async }}</strong>
        <button type="button" (click)="closeEditor.emit()">
          {{ 'page.editor.close' | i18n | async }}
        </button>
      </div>
      <app-markdown-editor [formControl]="control" [assets]="assets()"
        [label]="('page.editor.content' | i18n | async) ?? ''" />
    </div>
  `,
  styles: [`
    app-page-inline-markdown { display: block; min-width: 0; }
    .page-inline-markdown { min-width: 0; padding: 10px; border: 1px solid #edb4d5;
      border-radius: 10px; background: rgb(28 19 37 / 88%); }
    .page-inline-markdown__header { display: flex; align-items: center;
      justify-content: space-between; gap: 12px; padding: 0 0 9px; color: #f9d6e8; }
    .page-inline-markdown__header button { padding: 7px 12px; border: 1px solid #c791b5;
      border-radius: 7px; background: #69425f; color: white; cursor: pointer; }
    .page-inline-markdown .markdown-editor__toolbar { top: 0; }
    .page-inline-markdown .markdown-editor__surface,
    .page-inline-markdown .markdown-editor__content { min-height: 120px; }
  `],
})
export class PageInlineMarkdown {
  readonly markdown = input.required<string>();
  readonly assets = input<readonly Asset[]>([]);
  readonly markdownChange = output<string>();
  readonly closeEditor = output<void>();
  protected readonly control = new FormControl('', { nonNullable: true });

  constructor() {
    effect(() => {
      const next = this.markdown();
      if (this.control.value !== next)
        this.control.setValue(next, { emitEvent: false });
    });
    this.control.valueChanges.pipe(takeUntilDestroyed()).subscribe((value) => {
      if (value !== this.markdown()) this.markdownChange.emit(value);
    });
  }
}
