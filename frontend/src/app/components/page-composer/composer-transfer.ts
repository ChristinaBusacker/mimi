import type { PageComposerProfile, PageDocument } from '@shared/content/page-document';
import type { ComposerImportPreview } from '@shared/data-transfer/composer-archive-import';
import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, ElementRef, inject, input, output, signal, viewChild } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { ComposerArchiveClient, type ComposerSingleTarget } from '../../core/data-transfer/composer-archive.service';
import { composerArchiveErrorMessage } from '../../core/data-transfer/composer-archive-error';
import { I18nPipe } from '../../core/i18n/i18n.pipe';
import { Icon } from '../icon/icon';

type PendingImport = { kind: 'json'; document: PageDocument } | { kind: 'zip'; file: File; preview: ComposerImportPreview };
const MAX_LAYOUT_BYTES = 2 * 1024 * 1024;
const MAX_ZIP_BYTES = 528 * 1024 * 1024;

/** A draft-safe transfer dialog shared by ordinary pages and album booklets. */
@Component({
  selector: 'app-composer-transfer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AsyncPipe, I18nPipe, Icon],
  templateUrl: './composer-transfer.html',
  styleUrl: './composer-transfer.scss',
})
export class ComposerTransfer {
  private readonly api = inject(ComposerArchiveClient);
  private readonly dialog = viewChild<ElementRef<HTMLDialogElement>>('dialog');
  readonly document = input.required<PageDocument>();
  readonly profile = input<PageComposerProfile>('standard');
  readonly target = input<ComposerSingleTarget | null>(null);
  readonly unsaved = input(false);
  readonly disabled = input(false);
  readonly documentImport = output<PageDocument>();
  readonly zipImported = output<void>();

  protected readonly pending = signal<PendingImport | null>(null);
  protected readonly working = signal(false);
  protected readonly confirmed = signal(false);
  protected readonly error = signal('');
  protected readonly success = signal('');

  protected open(): void {
    if (this.disabled()) return;
    this.reset();
    this.dialog()?.nativeElement.showModal();
  }
  protected close(): void { if (!this.working()) this.dialog()?.nativeElement.close(); }
  protected reset(): void {
    this.pending.set(null);
    this.error.set('');
    this.success.set('');
    this.confirmed.set(false);
  }
  protected setConfirmed(event: Event): void {
    if (event.target instanceof HTMLInputElement) this.confirmed.set(event.target.checked);
  }
  protected async exportJson(): Promise<void> {
    this.error.set('');
    const payload = {
      format: 'mimi-composer-layout', version: 1,
      profile: this.profile(), exportedAt: new Date().toISOString(),
      document: this.document(),
    };
    this.download(new Blob([JSON.stringify(payload, null, 2) + '\n'], { type: 'application/json' }), 'json');
  }
  protected async exportZip(): Promise<void> {
    const target = this.target();
    if (!target || this.working()) return;
    this.working.set(true);
    this.error.set('');
    try {
      const blob = await firstValueFrom(this.api.export(target.kind === 'page' ? 'pages' : 'booklets', target.id));
      this.download(blob, 'zip');
    } catch (error: unknown) {
      this.error.set(await composerArchiveErrorMessage(error));
    } finally { this.working.set(false); }
  }
  protected async chooseFile(event: Event): Promise<void> {
    const picker = event.target;
    if (!(picker instanceof HTMLInputElement)) return;
    const file = picker.files?.[0];
    picker.value = ''; // selecting the same file again still triggers validation
    this.reset();
    if (!file || this.working()) return;
    if (!/\.(?:json|zip)$/i.test(file.name)) {
      this.error.set('transfer.single.error.extension'); return;
    }
    this.working.set(true);
    try {
      if (/\.json$/i.test(file.name)) {
        if (file.size > MAX_LAYOUT_BYTES) throw new Error('transfer.single.error.jsonSize');
        const payload: unknown = JSON.parse(await file.text());
        if (!payload || typeof payload !== 'object' || Array.isArray(payload))
          throw new Error('transfer.single.error.format');
        const obj = payload as Record<string, unknown>;
        if (obj['format'] !== 'mimi-composer-layout' || obj['version'] !== 1 || obj['profile'] !== this.profile())
          throw new Error('transfer.single.error.format');
        const document = await firstValueFrom(this.api.validateLayout(obj['document'], this.profile()));
        this.pending.set({ kind: 'json', document });
      } else {
        const target = this.target();
        if (!target) throw new Error('transfer.single.error.target');
        if (this.unsaved()) throw new Error('transfer.single.error.unsaved');
        if (file.size > MAX_ZIP_BYTES) throw new Error('transfer.single.error.zipSize');
        const preview = await firstValueFrom(this.api.previewSingle(file, target));
        if (preview.documents.length !== 1 || preview.documents[0].action !== 'replace-draft')
          throw new Error('transfer.single.error.conflict');
        this.pending.set({ kind: 'zip', file, preview });
      }
    } catch (error: unknown) {
      this.error.set(error instanceof SyntaxError ? 'transfer.single.error.invalidJson'
        : error instanceof Error && error.message.startsWith('transfer.single.')
          ? error.message : await composerArchiveErrorMessage(error));
    } finally { this.working.set(false); }
  }
  protected async importConfirmed(): Promise<void> {
    const pending = this.pending();
    if (!pending || !this.confirmed() || this.working() || this.disabled()) return;
    if (pending.kind === 'json') {
      // The host Composer receives an unsaved change, with its normal undo/save flow.
      this.documentImport.emit(structuredClone(pending.document));
      this.close();
      return;
    }
    const target = this.target();
    if (!target || this.unsaved()) { this.error.set('transfer.single.error.unsaved'); return; }
    this.working.set(true);
    this.error.set('');
    try {
      await firstValueFrom(this.api.importSingle(pending.file, target));
      this.zipImported.emit();
      this.dialog()?.nativeElement.close();
    } catch (error: unknown) {
      this.error.set((await composerArchiveErrorMessage(error)).replace('Composer-Export', 'Composer-Import'));
    } finally { this.working.set(false); }
  }
  private download(blob: Blob, extension: 'zip' | 'json'): void {
    const target = this.target();
    const name = target?.kind === 'album-booklet' ? 'booklet' : 'page';
    const href = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = href;
    link.download = `mimi-${name}-${new Date().toISOString().slice(0, 10)}.${extension}`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(href), 1000);
  }
}
