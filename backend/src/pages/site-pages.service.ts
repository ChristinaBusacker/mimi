import type { PageDocument } from '@shared/content/page-document';
import type {
  SitePageAdmin, SitePageMetadata, SitePagePublic, SitePageSummary,
} from '@shared/content/site-page';
import {
  BadRequestException, ConflictException, ForbiddenException,
  Injectable, NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, type EntityManager, Repository } from 'typeorm';

import { AssetUsageService } from '../assets/asset-usage.service';
import { AssetsService } from '../assets/assets.service';
import { validatePageDocument } from '../content/page-document-validation';
import { CreateSitePageDto, SitePageMetadataDto } from './dto/site-page.dto';
import { SitePageEntry } from './entities/site-page.entry';
import { collectSitePageAssets } from './site-page-assets';

/** Single-segment Angular routes that must not be shadowed by custom pages. */
const RESERVED_PUBLIC_SLUGS = new Set([
  'about', 'gaming', 'music', 'blog', 'impressum', 'datenschutz',
  'kontakt', 'unterstuetzen', 'community', 'account', 'admin',
  'videos', '404',
]);

@Injectable()
export class SitePagesService {
  constructor(
    @InjectRepository(SitePageEntry)
    private readonly repository: Repository<SitePageEntry>,
    private readonly dataSource: DataSource,
    private readonly assets: AssetsService,
    private readonly assetUsages: AssetUsageService,
  ) {}

  async list(): Promise<SitePageSummary[]> {
    const pages = await this.repository.find({ order: { updatedAt: 'DESC' } });
    return pages.map((page) => this.summary(page));
  }

  async getAdmin(uuid: string): Promise<SitePageAdmin> {
    return this.admin(await this.requirePage(uuid));
  }

  async getPublished(slug: string): Promise<SitePagePublic> {
    const page = await this.repository.findOneBy({ slug });
    if (!page?.published || !page.publishedMetadata || !page.publishedAt)
      throw new NotFoundException('Page not published.');
    return {
      key: page.key,
      slug: page.slug,
      kind: page.kind,
      metadata: page.publishedMetadata,
      document: page.published,
      publishedAt: page.publishedAt.toISOString(),
    };
  }

  async create(dto: CreateSitePageDto): Promise<SitePageAdmin> {
    // System identities are seeded by the schema migration, not created by an API caller.
    if (RESERVED_PUBLIC_SLUGS.has(dto.slug))
      throw new ConflictException('This slug is reserved for an existing route or system page.');
    try {
      const page = await this.dataSource.transaction(async (manager) => {
        const repository = manager.getRepository(SitePageEntry);
        const entry = repository.create({
          key: `page:${dto.slug}`,
          slug: dto.slug,
          kind: 'custom',
          draftMetadata: dto.metadata,
          publishedMetadata: null,
          draft: null,
          published: null,
          publishedAt: null,
        });
        const saved = await repository.save(entry);
        await this.validateAndSyncAssets(manager, saved);
        return saved;
      });
      return this.admin(page);
    } catch (error: unknown) {
      this.rethrowUniqueConflict(error);
      throw error;
    }
  }

  async updateMetadata(uuid: string, metadata: SitePageMetadataDto): Promise<SitePageAdmin> {
    await this.dataSource.transaction(async (manager) => {
      const page = await this.lockPage(manager, uuid);
      page.draftMetadata = metadata;
      await this.validateAndSyncAssets(manager, page);
      await manager.getRepository(SitePageEntry).save(page);
    });
    return this.getAdmin(uuid);
  }

  async saveDraft(uuid: string, input: unknown): Promise<SitePageAdmin> {
    const document = validatePageDocument(input, 'standard');
    await this.dataSource.transaction(async (manager) => {
      const page = await this.lockPage(manager, uuid);
      page.draft = document;
      await this.validateAndSyncAssets(manager, page);
      await manager.getRepository(SitePageEntry).save(page);
    });
    return this.getAdmin(uuid);
  }

  async publish(uuid: string): Promise<SitePageAdmin> {
    await this.dataSource.transaction(async (manager) => {
      const page = await this.lockPage(manager, uuid);
      if (!page.draft || page.draft.sections.length === 0)
        throw new BadRequestException('A non-empty saved draft is required for publication.');
      // Publish an immutable snapshot; subsequent edits only change the draft.
      page.published = structuredClone(page.draft) as PageDocument;
      page.publishedMetadata = structuredClone(page.draftMetadata) as SitePageMetadata;
      page.publishedAt = new Date();
      await this.validateAndSyncAssets(manager, page);
      await manager.getRepository(SitePageEntry).save(page);
    });
    return this.getAdmin(uuid);
  }

  async delete(uuid: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const page = await this.lockPage(manager, uuid);
      if (page.kind === 'system')
        throw new ForbiddenException('System pages cannot be deleted.');
      await this.assetUsages.clearOwner(manager, 'sitePage', page.uuid);
      await manager.getRepository(SitePageEntry).delete({ uuid });
    });
  }

  private async requirePage(uuid: string): Promise<SitePageEntry> {
    const page = await this.repository.findOneBy({ uuid });
    if (!page) throw new NotFoundException('Page not found.');
    return page;
  }

  private async lockPage(manager: EntityManager, uuid: string): Promise<SitePageEntry> {
    const page = await manager.getRepository(SitePageEntry).findOne({
      where: { uuid }, lock: { mode: 'pessimistic_write' },
    });
    if (!page) throw new NotFoundException('Page not found.');
    return page;
  }

  private async validateAndSyncAssets(
    manager: EntityManager,
    page: SitePageEntry,
  ): Promise<void> {
    const ids = collectSitePageAssets(
      [page.draft, page.published],
      [page.draftMetadata, page.publishedMetadata],
    );
    for (const id of ids) {
      const asset = await this.assets.getById(id);
      if (asset.type !== 'image')
        throw new BadRequestException(`Asset "${id}" must be an image.`);
    }
    // One union for draft AND published references, so an old live image remains protected.
    await this.assetUsages.syncOwner(
      manager, 'sitePage', page.uuid, ids.map((assetUuid) => ({ assetUuid, scope: 'content' })),
    );
  }

  private summary(page: SitePageEntry): SitePageSummary {
    return {
      id: page.uuid,
      key: page.key,
      slug: page.slug,
      kind: page.kind,
      draftMetadata: page.draftMetadata,
      publishedMetadata: page.publishedMetadata,
      hasDraft: page.draft !== null,
      hasPublished: page.published !== null,
      publishedAt: page.publishedAt?.toISOString() ?? null,
      createdAt: page.createdAt.toISOString(),
      updatedAt: page.updatedAt.toISOString(),
    };
  }

  private admin(page: SitePageEntry): SitePageAdmin {
    return { ...this.summary(page), draft: page.draft, published: page.published };
  }

  private rethrowUniqueConflict(error: unknown): void {
    if (
      error !== null && typeof error === 'object' &&
      'driverError' in error &&
      typeof error.driverError === 'object' && error.driverError !== null &&
      'code' in error.driverError && error.driverError.code === '23505'
    ) throw new ConflictException('A page with this slug or key already exists.');
  }
}
