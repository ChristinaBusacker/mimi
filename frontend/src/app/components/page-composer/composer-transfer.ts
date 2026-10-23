import type { ComposerImportPreview } from '@shared/data-transfer/composer-archive-import';
import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, ElementRef, inject, input, output, signal, viewChild } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { ComposerArchiveClient, type ComposerSingleTarget } from '../../core/data-transfer/composer-archive.service';
import { composerArchiveErrorMessage } from '../../core/data-transfer/composer-archive-error';
import { I18nPipe } from '../../core/i18n/i18n.pipe';
import { Icon } from '../icon/icon';

type PendingImport = { file: File; preview: ComposerImportPreview };
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
  readonly target = input<ComposerSingleTarget | null>(null);
  readonly unsaved = input(false);
  readonly disabled = input(false);
  readonly zipImported = output<void>();

  protected readonly pending = signal<PendingImport | null>(null);
  protected readonly working = signal(false);
  protected readonly confirmed = signal(false);
  protected readonly error = signal('');

  protected openImport(): void {
    if (this.disabled()) return;
    this.reset();
    this.dialog()?.nativeElement.showModal();
  }
  protected close(): void { if (!this.working()) this.dialog()?.nativeElement.close(); }
  protected reset(): void {
    this.pending.set(null);
    this.error.set('');
    this.confirmed.set(false);
  }
  protected setConfirmed(event: Event): void {
    if (event.target instanceof HTMLInputElement) this.confirmed.set(event.target.checked);
  }
  protected async exportZip(): Promise<void> {
    const target = this.target();
    if (!target || this.working() || this.disabled()) return;
    this.error.set('');
    if (this.unsaved()) {
      this.error.set('transfer.single.error.unsavedExport');
      return;
    }
    this.working.set(true);
    try {
      const blob = await firstValueFrom(this.api.exportSingle(target));
      this.download(blob);
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
    if (!/\.zip$/i.test(file.name)) {
      this.error.set('transfer.single.error.zipExtension'); return;
    }
    this.working.set(true);
    try {
      const target = this.target();
      if (!target) throw new Error('transfer.single.error.target');
      if (this.unsaved()) throw new Error('transfer.single.error.unsaved');
      if (file.size > MAX_ZIP_BYTES) throw new Error('transfer.single.error.zipSize');
      const preview = await firstValueFrom(this.api.previewSingle(file, target));
      if (preview.documents.length !== 1 || preview.documents[0].action !== 'replace-draft')
        throw new Error('transfer.single.error.conflict');
      this.pending.set({ file, preview });
    } catch (error: unknown) {
      this.error.set(error instanceof Error && error.message.startsWith('transfer.single.')
        ? error.message : (await composerArchiveErrorMessage(error)).replace('Composer-Export', 'Composer-Import'));
    } finally { this.working.set(false); }
  }
  protected async importConfirmed(): Promise<void> {
    const pending = this.pending();
    if (!pending || !this.confirmed() || this.working() || this.disabled()) return;
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
  private download(blob: Blob): void {
    const target = this.target();
    const name = target?.kind === 'album-booklet' ? 'booklet' : 'page';
    const href = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = href;
    link.download = `mimi-${name}-${new Date().toISOString().slice(0, 10)}.zip`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(href), 1000);
  }
}
