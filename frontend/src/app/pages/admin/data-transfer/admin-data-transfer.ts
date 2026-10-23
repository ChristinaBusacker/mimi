import type {
  DataTransferImportResult,
  DataTransferValidationResult,
} from '@shared/data-transfer/data-transfer';

import {
  AsyncPipe,
  DOCUMENT,
} from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { Button } from '../../../components/button/button';
import { AdminDataTransferService } from '../../../core/data-transfer/admin-data-transfer.service';
import { ComposerArchiveClient, type ComposerArchiveScope } from '../../../core/data-transfer/composer-archive.service';
import type { ComposerImportPreview, ComposerImportResult } from '@shared/data-transfer/composer-archive-import';
import { composerArchiveErrorMessage } from '../../../core/data-transfer/composer-archive-error';
import { I18nPipe } from '../../../core/i18n/i18n.pipe';
import { LanguageService } from '../../../core/i18n/language.service';

type AdminDataTransferType =
  | 'localizations'
  | 'community-settings';

type DataTransferErrorAction =
  | 'load'
  | 'export'
  | 'bundle-export'
  | 'read'
  | 'validate'
  | 'import';

interface PendingImport {
  type: AdminDataTransferType;
  fileName: string;
  payload: unknown;
  validation: DataTransferValidationResult;
}

interface ImportSuccess {
  type: AdminDataTransferType;
  result: DataTransferImportResult;
}

interface DataTransferError {
  type: AdminDataTransferType | null;
  action: DataTransferErrorAction;
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AsyncPipe,
    Button,
    I18nPipe,
  ],
  selector: 'app-admin-data-transfer',
  styleUrl: './admin-data-transfer.scss',
  templateUrl: './admin-data-transfer.html',
})
export class AdminDataTransfer implements OnInit {
  private readonly dataTransfer =
    inject(AdminDataTransferService);
  private readonly composerArchive = inject(ComposerArchiveClient);
  private readonly language =
    inject(LanguageService);
  private readonly document =
    inject(DOCUMENT);

  protected readonly archiveOptions: readonly ComposerArchiveScope[] = ['all', 'pages', 'booklets'];
  protected readonly archiveScope = signal<ComposerArchiveScope | null>(null);
  protected readonly archiveError = signal<string | null>(null);
  protected readonly archiveFile = signal<File | null>(null);
  protected readonly archiveOverwrite = signal(false);
  protected readonly archivePreview = signal<ComposerImportPreview | null>(null);
  protected readonly archiveImportResult = signal<ComposerImportResult | null>(null);
  protected readonly archiveImportError = signal<string | null>(null);
  protected readonly archiveImportBusy = signal(false);
  protected readonly loading = signal(true);
  protected readonly availableTypes =
    signal<string[]>([]);
  protected readonly busyType =
    signal<AdminDataTransferType | null>(null);
  protected readonly exportingBundle =
    signal(false);
  protected readonly pendingImport =
    signal<PendingImport | null>(null);
  protected readonly importSuccess =
    signal<ImportSuccess | null>(null);
  protected readonly error =
    signal<DataTransferError | null>(null);

  async ngOnInit(): Promise<void> {
    try {
      const providers =
        await firstValueFrom(
          this.dataTransfer.getProviders(),
        );

      this.availableTypes.set(
        providers.map(
          (provider) => provider.type,
        ),
      );
    } catch {
      this.error.set({
        type: null,
        action: 'load',
      });
    } finally {
      this.loading.set(false);
    }
  }

  protected isAvailable(
    type: AdminDataTransferType,
  ): boolean {
    return this.availableTypes()
      .includes(type);
  }

  protected isBusy(
    type: AdminDataTransferType,
  ): boolean {
    return this.busyType() === type;
  }

  protected async exportSection(
    type: AdminDataTransferType,
  ): Promise<void> {
    if (
      !this.isAvailable(type) ||
      this.busyType() !== null ||
      this.exportingBundle()
    ) {
      return;
    }

    this.busyType.set(type);
    this.error.set(null);
    this.importSuccess.set(null);

    try {
      const exported =
        await firstValueFrom(
          this.dataTransfer.exportSection(
            type,
          ),
        );

      this.downloadJson(
        exported,
        `mimi-${type}-${this.dateStamp()}.json`,
      );
    } catch {
      this.error.set({
        type,
        action: 'export',
      });
    } finally {
      this.busyType.set(null);
    }
  }

  protected async exportAll():
    Promise<void> {
    if (
      this.exportingBundle() ||
      this.busyType() !== null
    ) {
      return;
    }

    this.exportingBundle.set(true);
    this.error.set(null);
    this.importSuccess.set(null);

    try {
      const exported =
        await firstValueFrom(
          this.dataTransfer.exportBundle(),
        );

      this.downloadJson(
        exported,
        `mimi-settings-${this.dateStamp()}.json`,
      );
    } catch {
      this.error.set({
        type: null,
        action: 'bundle-export',
      });
    } finally {
      this.exportingBundle.set(false);
    }
  }

  protected async selectImport(
    type: AdminDataTransferType,
    event: Event,
  ): Promise<void> {
    const target = event.target;

    if (!(target instanceof HTMLInputElement)) {
      return;
    }

    const file = target.files?.[0];
    target.value = '';

    if (!file) {
      return;
    }

    this.busyType.set(type);
    this.error.set(null);
    this.importSuccess.set(null);
    this.pendingImport.set(null);

    let payload: unknown;

    try {
      payload = JSON.parse(
        await file.text(),
      ) as unknown;
    } catch {
      this.error.set({
        type,
        action: 'read',
      });
      this.busyType.set(null);

      return;
    }

    try {
      const validation =
        await firstValueFrom(
          this.dataTransfer.validateImport(
            type,
            payload,
          ),
        );

      this.pendingImport.set({
        type,
        fileName: file.name,
        payload,
        validation,
      });
    } catch {
      this.error.set({
        type,
        action: 'validate',
      });
    } finally {
      this.busyType.set(null);
    }
  }

  protected cancelImport(): void {
    this.pendingImport.set(null);
    this.error.set(null);
  }

  protected async confirmImport():
    Promise<void> {
    const pending = this.pendingImport();

    if (
      !pending ||
      this.busyType() !== null
    ) {
      return;
    }

    this.busyType.set(pending.type);
    this.error.set(null);

    try {
      const result =
        await firstValueFrom(
          this.dataTransfer.importSection(
            pending.type,
            pending.payload,
          ),
        );

      if (pending.type === 'localizations') {
        await firstValueFrom(
          this.language.initialize(),
        );
      }

      this.pendingImport.set(null);
      this.importSuccess.set({
        type: pending.type,
        result,
      });
    } catch {
      this.error.set({
        type: pending.type,
        action: 'import',
      });
    } finally {
      this.busyType.set(null);
    }
  }

  protected async exportComposer(scope: ComposerArchiveScope): Promise<void> {
    if (this.archiveScope() !== null || this.exportingBundle() || this.busyType() !== null) return;
    this.archiveScope.set(scope);
    this.archiveError.set(null);
    try {
      const blob = await firstValueFrom(this.composerArchive.export(scope));
      const win = this.document.defaultView;
      if (!win) return;
      const url = win.URL.createObjectURL(blob);
      const link = this.document.createElement('a');
      link.href = url;
      link.download = `mimi-composer-${scope}-${this.dateStamp()}.zip`;
      link.hidden = true;
      this.document.body.append(link);
      link.click();
      link.remove();
      win.URL.revokeObjectURL(url);
    } catch (error: unknown) {
      this.archiveError.set(await composerArchiveErrorMessage(error));
    } finally {
      this.archiveScope.set(null);
    }
  }

  protected async selectComposerArchive(event: Event): Promise<void> {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) return;
    const file = input.files?.[0] ?? null;
    input.value = '';
    this.archiveFile.set(file);
    this.archiveOverwrite.set(false);
    await this.previewComposerArchive();
  }

  protected async toggleArchiveOverwrite(event: Event): Promise<void> {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) return;
    this.archiveOverwrite.set(input.checked);
    await this.previewComposerArchive();
  }

  private async previewComposerArchive(): Promise<void> {
    this.archivePreview.set(null);
    this.archiveImportResult.set(null);
    this.archiveImportError.set(null);
    const file = this.archiveFile();
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.zip')) {
      this.archiveImportError.set('Bitte eine Composer-ZIP-Datei auswählen.');
      return;
    }
    this.archiveImportBusy.set(true);
    try {
      this.archivePreview.set(await firstValueFrom(this.composerArchive.preview(file, this.archiveOverwrite())));
    } catch (error: unknown) {
      this.archiveImportError.set((await composerArchiveErrorMessage(error)).replace('Composer-Export', 'Composer-Import'));
    } finally { this.archiveImportBusy.set(false); }
  }

  protected async confirmComposerImport(): Promise<void> {
    const file = this.archiveFile();
    if (!file || !this.archivePreview() || this.archiveImportBusy()) return;
    this.archiveImportBusy.set(true);
    this.archiveImportError.set(null);
    try {
      const result = await firstValueFrom(this.composerArchive.import(file, this.archiveOverwrite()));
      this.archiveImportResult.set(result);
      this.archivePreview.set(null);
      this.archiveFile.set(null);
    } catch (error: unknown) {
      this.archiveImportError.set((await composerArchiveErrorMessage(error)).replace('Composer-Export', 'Composer-Import'));
    } finally { this.archiveImportBusy.set(false); }
  }

  protected cancelComposerImport(): void {
    this.archiveFile.set(null);
    this.archivePreview.set(null);
    this.archiveImportError.set(null);
  }

  private downloadJson(
    value: unknown,
    fileName: string,
  ): void {
    const browserWindow =
      this.document.defaultView;

    if (!browserWindow) {
      return;
    }

    const blob = new Blob(
      [JSON.stringify(value, null, 2)],
      {
        type: 'application/json;charset=utf-8',
      },
    );
    const url =
      browserWindow.URL.createObjectURL(
        blob,
      );
    const anchor =
      this.document.createElement('a');

    anchor.href = url;
    anchor.download = fileName;
    anchor.hidden = true;
    this.document.body.append(anchor);
    anchor.click();
    anchor.remove();
    browserWindow.URL.revokeObjectURL(url);
  }

  private dateStamp(): string {
    return new Date()
      .toISOString()
      .slice(0, 10);
  }
}
