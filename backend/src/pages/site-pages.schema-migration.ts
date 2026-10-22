import type { EntityManager } from 'typeorm';
import type { SitePageMetadata } from '@shared/content/site-page';

/** Only seeds identities and draft metadata. Existing public Angular routes stay live. */
const systemPages = [
  { key: 'system:about', slug: 'about', de: 'Über Mimi', en: 'About Mimi' },
  { key: 'system:impressum', slug: 'impressum', de: 'Impressum', en: 'Legal notice' },
  { key: 'system:datenschutz', slug: 'datenschutz', de: 'Datenschutz', en: 'Privacy policy' },
] as const;

export const sitePagesSchemaMigration = {
  name: '20261022-site-pages-foundation',
  run: async (manager: EntityManager): Promise<void> => {
    await manager.query(`
      CREATE TABLE IF NOT EXISTS "site_pages" (
        "uuid" uuid NOT NULL DEFAULT gen_random_uuid(),
        "key" varchar(200) NOT NULL,
        "slug" varchar(160) NOT NULL,
        "kind" varchar(20) NOT NULL,
        "draftMetadata" jsonb NOT NULL,
        "publishedMetadata" jsonb,
        "draft" jsonb,
        "published" jsonb,
        "publishedAt" timestamptz,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_site_pages" PRIMARY KEY ("uuid"),
        CONSTRAINT "UQ_site_pages_key" UNIQUE ("key"),
        CONSTRAINT "UQ_site_pages_slug" UNIQUE ("slug"),
        CONSTRAINT "CHK_site_pages_kind" CHECK ("kind" IN ('system', 'custom'))
      )
    `);
    await manager.query(`
      CREATE INDEX IF NOT EXISTS "IDX_site_pages_published"
      ON "site_pages" ("slug") WHERE "published" IS NOT NULL
    `);
    for (const page of systemPages) {
      const metadata: SitePageMetadata = {
        title: { de: page.de, en: page.en },
        seoTitle: { de: page.de, en: page.en },
        seoDescription: { de: '', en: '' },
        seoImageAssetId: null,
        indexable: true,
      };
      await manager.query(
        `INSERT INTO "site_pages" ("key", "slug", "kind", "draftMetadata")
         VALUES ($1, $2, 'system', $3::jsonb)
         ON CONFLICT ("key") DO NOTHING`,
        [page.key, page.slug, JSON.stringify(metadata)],
      );
    }
  },
};
