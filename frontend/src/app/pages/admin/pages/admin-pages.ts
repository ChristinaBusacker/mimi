import type { SitePageSummary } from '@shared/content/site-page';
import { AsyncPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { I18nPipe } from '../../../core/i18n/i18n.pipe';
import { AdminPagesService } from '../../../core/pages/admin-pages.service';
import { createSitePageInput } from '../../../core/pages/site-page-form';

@Component({
  selector: 'app-admin-pages',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AsyncPipe, DatePipe, I18nPipe, RouterLink],
  templateUrl: './admin-pages.html',
  styleUrl: './admin-pages.scss',
})
export class AdminPages implements OnInit {
  private readonly api = inject(AdminPagesService);
  private readonly router = inject(Router);

  protected readonly pages = signal<SitePageSummary[]>([]);
  protected readonly loading = signal(true);
  protected readonly working = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly creating = signal(false);
  protected readonly slug = signal('');
  protected readonly titleDe = signal('');
  protected readonly titleEn = signal('');
  protected readonly confirmingId = signal<string | null>(null);

  async ngOnInit(): Promise<void> { await this.reload(); }

  protected setField(field: 'slug' | 'titleDe' | 'titleEn', event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    this[field].set(target.value);
    this.error.set(null);
  }

  protected canCreate(): boolean {
    return !this.working() && !!createSitePageInput(this.slug(), this.titleDe(), this.titleEn());
  }

  protected async create(): Promise<void> {
    const input = createSitePageInput(this.slug(), this.titleDe(), this.titleEn());
    if (!input || this.working()) return;
    this.working.set(true);
    this.error.set(null);
    try {
      const created = await firstValueFrom(this.api.create(input));
      await this.router.navigate(['/admin/pages', created.id]);
    } catch (error: unknown) {
      this.error.set(error instanceof HttpErrorResponse && error.status === 409
        ? 'admin.pages.error.conflict' : 'admin.pages.error.save');
    } finally {
      this.working.set(false);
    }
  }

  protected async deletePage(page: SitePageSummary): Promise<void> {
    if (page.kind === 'system' || this.working() || this.confirmingId() !== page.id) return;
    this.working.set(true);
    this.error.set(null);
    try {
      await firstValueFrom(this.api.delete(page.id));
      this.confirmingId.set(null);
      await this.reload();
    } catch {
      this.error.set('admin.pages.error.delete');
    } finally {
      this.working.set(false);
    }
  }

  private async reload(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      this.pages.set(await firstValueFrom(this.api.list()));
    } catch {
      this.error.set('admin.pages.error.load');
    } finally {
      this.loading.set(false);
    }
  }
}
