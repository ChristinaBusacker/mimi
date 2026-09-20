import type {
  Localization,
  SaveLocalization,
} from '@shared/localizations/localization';

import { AsyncPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { I18nPipe } from '../../../core/i18n/i18n.pipe';
import { AdminLocalizationsService } from '../../../core/i18n/admin-localizations.service';

type LocalizationField =
  | 'key'
  | 'de'
  | 'en';

interface LocalizationRow extends Localization {
  original: SaveLocalization;
  error: boolean;
  confirmingDelete: boolean;
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AsyncPipe,
    I18nPipe,
  ],
  selector: 'app-admin-localizations',
  styleUrl: './admin-localizations.scss',
  templateUrl: './admin-localizations.html',
})
export class AdminLocalizations implements OnInit {
  private readonly localizations =
    inject(AdminLocalizationsService);

  protected readonly rows = signal<LocalizationRow[]>([]);
  protected readonly search = signal('');
  protected readonly loading = signal(true);
  protected readonly loadFailed = signal(false);
  protected readonly savingAll = signal(false);

  protected readonly newKey = signal('');
  protected readonly newDe = signal('');
  protected readonly newEn = signal('');
  protected readonly creating = signal(false);
  protected readonly createError = signal(false);

  protected readonly filteredRows = computed(() => {
    const query = this.search()
      .trim()
      .toLocaleLowerCase();

    return this.rows().filter((row) => {
      if (!query) {
        return true;
      }

      return [
        row.key,
        row.de,
        row.en,
      ].some((value) =>
        value
          .toLocaleLowerCase()
          .includes(query),
      );
    });
  });

  protected readonly dirtyCount = computed(
    () =>
      this.rows().filter(
        (row) => this.isDirty(row),
      ).length,
  );

  async ngOnInit(): Promise<void> {
    try {
      const rows = await firstValueFrom(
        this.localizations.getAll(),
      );

      this.rows.set(
        this.sortRows(
          rows.map((row) =>
            this.toRow(row),
          ),
        ),
      );
    } catch {
      this.loadFailed.set(true);
    } finally {
      this.loading.set(false);
    }
  }

  protected isDirty(row: LocalizationRow): boolean {
    return (
      row.key !== row.original.key ||
      row.de !== row.original.de ||
      row.en !== row.original.en
    );
  }

  protected setSearch(event: Event): void {
    this.search.set(
      this.readInputValue(event),
    );
  }

  protected updateRow(
    uuid: string,
    field: LocalizationField,
    event: Event,
  ): void {
    const value = this.readInputValue(event);

    this.rows.update((rows) =>
      rows.map((row) =>
        row.uuid === uuid
          ? {
              ...row,
              [field]: value,
              error: false,
            }
          : row,
      ),
    );
  }

  protected setNewValue(
    field: LocalizationField,
    event: Event,
  ): void {
    const value = this.readInputValue(event);

    if (field === 'key') {
      this.newKey.set(value);
    } else if (field === 'de') {
      this.newDe.set(value);
    } else {
      this.newEn.set(value);
    }

    this.createError.set(false);
  }

  protected async create(): Promise<void> {
    const key = this.newKey().trim();

    if (!key || this.creating()) {
      this.createError.set(true);

      return;
    }

    this.creating.set(true);
    this.createError.set(false);

    try {
      const created = await firstValueFrom(
        this.localizations.create({
          key,
          de: this.newDe(),
          en: this.newEn(),
        }),
      );

      this.rows.update((rows) =>
        this.sortRows([
          ...rows,
          this.toRow(created),
        ]),
      );

      this.newKey.set('');
      this.newDe.set('');
      this.newEn.set('');
    } catch {
      this.createError.set(true);
    } finally {
      this.creating.set(false);
    }
  }

  protected async saveAll(): Promise<void> {
    if (this.savingAll()) {
      return;
    }

    const dirtyRows = this.rows().filter(
      (row) => this.isDirty(row),
    );

    if (dirtyRows.length === 0) {
      return;
    }

    this.savingAll.set(true);

    for (const dirtyRow of dirtyRows) {
      const current = this.rows().find(
        (row) => row.uuid === dirtyRow.uuid,
      );

      if (!current || !this.isDirty(current)) {
        continue;
      }

      const key = current.key.trim();

      if (!key) {
        this.patchRow(current.uuid, {
          error: true,
        });

        continue;
      }

      try {
        const saved = await firstValueFrom(
          this.localizations.update(
            current.uuid,
            {
              key,
              de: current.de,
              en: current.en,
            },
          ),
        );

        this.rows.update((rows) =>
          rows.map((row) =>
            row.uuid === current.uuid
              ? this.toRow(saved)
              : row,
          ),
        );
      } catch {
        this.patchRow(current.uuid, {
          error: true,
        });
      }
    }

    this.rows.update(
      (rows) => this.sortRows(rows),
    );
    this.savingAll.set(false);
  }

  protected requestDelete(uuid: string): void {
    this.rows.update((rows) =>
      rows.map((row) => ({
        ...row,
        confirmingDelete:
          row.uuid === uuid,
      })),
    );
  }

  protected cancelDelete(uuid: string): void {
    this.patchRow(uuid, {
      confirmingDelete: false,
    });
  }

  protected async deleteRow(
    row: LocalizationRow,
  ): Promise<void> {
    try {
      await firstValueFrom(
        this.localizations.delete(row.uuid),
      );

      this.rows.update((rows) =>
        rows.filter(
          (candidate) =>
            candidate.uuid !== row.uuid,
        ),
      );
    } catch {
      this.patchRow(row.uuid, {
        confirmingDelete: false,
        error: true,
      });
    }
  }

  private patchRow(
    uuid: string,
    patch: Partial<LocalizationRow>,
  ): void {
    this.rows.update((rows) =>
      rows.map((row) =>
        row.uuid === uuid
          ? {
              ...row,
              ...patch,
            }
          : row,
      ),
    );
  }

  private toRow(
    localization: Localization,
  ): LocalizationRow {
    return {
      ...localization,
      original: {
        key: localization.key,
        de: localization.de,
        en: localization.en,
      },
      error: false,
      confirmingDelete: false,
    };
  }

  private sortRows(
    rows: LocalizationRow[],
  ): LocalizationRow[] {
    return rows
      .slice()
      .sort((left, right) =>
        left.original.key.localeCompare(
          right.original.key,
        ),
      );
  }

  private readInputValue(event: Event): string {
    const target = event.target;

    return target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement
      ? target.value
      : '';
  }
}
