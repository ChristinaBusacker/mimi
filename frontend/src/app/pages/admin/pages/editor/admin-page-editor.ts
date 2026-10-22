import type { Asset } from '@shared/assets/asset';
import type { PageDocument } from '@shared/content/page-document';
import type { SitePageAdmin, SitePageMetadata } from '@shared/content/site-page';
import { HttpErrorResponse } from '@angular/common/http';
import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, HostListener, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { firstValueFrom, forkJoin } from 'rxjs';
import { AssetPicker } from '../../../../components/asset-picker/asset-picker';
import { PageEditor } from '../../../../components/page-composer/page-editor';
import { AdminAssetsService } from '../../../../core/assets/admin-assets.service';
import { I18nPipe } from '../../../../core/i18n/i18n.pipe';
import { AdminPagesService } from '../../../../core/pages/admin-pages.service';
import { emptySitePageDocument, hasPublishableDocument, validSitePageMetadata } from '../../../../core/pages/site-page-form';

type Locale = 'de' | 'en';
type TextField = 'title' | 'seoTitle' | 'seoDescription';

@Component({
  selector: 'app-admin-page-editor',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AsyncPipe, FormsModule, I18nPipe, RouterLink, AssetPicker, PageEditor],
  templateUrl: './admin-page-editor.html',
  styleUrl: './admin-page-editor.scss',
})
export class AdminPageEditor implements OnInit {
  private readonly api = inject(AdminPagesService);
  private readonly assetsApi = inject(AdminAssetsService);
  private readonly route = inject(ActivatedRoute);
  protected readonly pageId = this.route.snapshot.paramMap.get('id') ?? '';
  protected readonly locales: readonly Locale[] = ['de', 'en'];
  protected readonly page = signal<SitePageAdmin | null>(null);
  protected readonly metadata = signal<SitePageMetadata | null>(null);
  private readonly savedMetadata = signal<SitePageMetadata | null>(null);
  protected readonly document = signal<PageDocument>(emptySitePageDocument());
  private readonly savedDocument = signal<PageDocument>(emptySitePageDocument());
  protected readonly images = signal<Asset[]>([]);
  protected readonly loading = signal(true);
  protected readonly working = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);
  protected readonly metadataDirty = computed(() =>
    JSON.stringify(this.metadata()) !== JSON.stringify(this.savedMetadata()),
  );
  protected readonly documentDirty = computed(() =>
    JSON.stringify(this.document()) !== JSON.stringify(this.savedDocument()),
  );
  protected readonly dirty = computed(() => this.metadataDirty() || this.documentDirty());
  /** A saved draft can differ from the currently published snapshot. */
  protected readonly pendingPublication = computed(() => {
    const page = this.page();
    if (!page?.hasPublished) return false;
    return (page.draft !== null && JSON.stringify(page.draft) !== JSON.stringify(page.published)) ||
      JSON.stringify(page.draftMetadata) !== JSON.stringify(page.publishedMetadata);
  });
  protected readonly canPublish = computed(() =>
    !this.loading() && !this.working() && hasPublishableDocument(this.document()),
  );

  async ngOnInit(): Promise<void> {
    try {
      const result = await firstValueFrom(forkJoin({
        page: this.api.get(this.pageId),
        images: this.assetsApi.getAll('image'),
      }));
      this.page.set(result.page);
      this.metadata.set(structuredClone(result.page.draftMetadata));
      this.savedMetadata.set(structuredClone(result.page.draftMetadata));
      const document = result.page.draft ?? result.page.published ?? emptySitePageDocument();
      this.document.set(structuredClone(document));
      // An unpublished initial document is not yet persisted by the backend.
      this.savedDocument.set(structuredClone(document));
      this.images.set(result.images);
    } catch {
      this.error.set('admin.pages.error.load');
    } finally {
      this.loading.set(false);
    }
  }

  hasUnsavedChanges(): boolean { return this.dirty(); }

  @HostListener('window:beforeunload', ['$event'])
  protected preventAccidentalClose(event: BeforeUnloadEvent): void {
    if (!this.hasUnsavedChanges()) return;
    event.preventDefault();
    event.returnValue = '';
  }

  protected setText(field: TextField, locale: Locale, event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) && !(target instanceof HTMLTextAreaElement)) return;
    this.metadata.update((current) => current ? {
      ...current, [field]: { ...current[field], [locale]: target.value },
    } : null);
    this.notice.set(null);
  }

  protected setIndexable(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    this.metadata.update((current) => current ? { ...current, indexable: target.checked } : null);
    this.notice.set(null);
  }

  protected setSeoImage(id: string): void {
    this.metadata.update((current) => current ? { ...current, seoImageAssetId: id || null } : null);
    this.notice.set(null);
  }

  protected upsertImage(asset: Asset): void {
    this.images.update((all) => [...all.filter((item) => item.id !== asset.id), asset]);
  }

  protected removeImage(id: string): void {
    this.images.update((all) => all.filter((asset) => asset.id !== id));
    if (this.metadata()?.seoImageAssetId === id) this.setSeoImage('');
  }

  protected updateDocument(value: PageDocument): void {
    this.document.set(value);
    this.notice.set(null);
  }

  /** Each HTTP call is awaited before publishing; failed saves leave the editor dirty. */
  protected async save(publish = false): Promise<void> {
    const page = this.page();
    const metadata = this.metadata();
    if (this.working()) return;
    if (!page || !metadata || !validSitePageMetadata(metadata)) {
      this.error.set('admin.pages.error.validation');
      return;
    }
    if (publish && !hasPublishableDocument(this.document())) {
      this.error.set('admin.pages.error.empty');
      return;
    }
    this.working.set(true);
    this.error.set(null);
    this.notice.set(null);
    const metadataSnapshot = structuredClone(metadata);
    const documentSnapshot = structuredClone(this.document());
    try {
      let updated = page;
      if (this.metadataDirty()) {
        updated = await firstValueFrom(this.api.updateMetadata(page.id, metadataSnapshot));
        this.savedMetadata.set(metadataSnapshot);
      }
      if (this.documentDirty() || (!updated.hasDraft && hasPublishableDocument(documentSnapshot))) {
        updated = await firstValueFrom(this.api.saveDraft(page.id, documentSnapshot));
        this.savedDocument.set(documentSnapshot);
      }
      if (publish) updated = await firstValueFrom(this.api.publish(page.id));
      this.page.set(updated);
      this.notice.set(publish ? 'admin.pages.notice.published' : 'admin.pages.notice.saved');
    } catch (error: unknown) {
      this.error.set(error instanceof HttpErrorResponse && error.status === 409
        ? 'admin.pages.error.conflict' : 'admin.pages.error.save');
    } finally {
      this.working.set(false);
    }
  }
}
