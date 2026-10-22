import type { PageDocument } from '@shared/content/page-document';
import type { SitePageAdmin, SitePageMetadata } from '@shared/content/site-page';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { RequestService } from '../http/request.service';
import { AdminPagesService } from './admin-pages.service';

const metadata: SitePageMetadata = {
  title: { de: 'Test', en: 'Test' }, seoTitle: { de: 'Test', en: 'Test' },
  seoDescription: { de: '', en: '' }, seoImageAssetId: null, indexable: true,
};
const document: PageDocument = {
  id: 'page', schemaVersion: 1, styles: {}, sections: [],
};

describe('AdminPagesService', () => {
  it('uses the private, noncached endpoints and the DTO request bodies', () => {
    const request = {
      get: vi.fn().mockReturnValue(of([])),
      post: vi.fn().mockReturnValue(of({} as SitePageAdmin)),
      patch: vi.fn().mockReturnValue(of({} as SitePageAdmin)),
      delete: vi.fn().mockReturnValue(of(undefined)),
    };
    TestBed.configureTestingModule({ providers: [{ provide: RequestService, useValue: request }] });
    const api = TestBed.inject(AdminPagesService);
    api.list().subscribe();
    api.get('some-id').subscribe();
    api.create({ slug: 'example', metadata }).subscribe();
    api.updateMetadata('some-id', metadata).subscribe();
    api.saveDraft('some-id', document).subscribe();
    api.publish('some-id').subscribe();
    api.delete('some-id').subscribe();
    expect(request.get).toHaveBeenCalledWith('/admin/pages', { deduplicateAcrossTabs: false, transferCache: false });
    expect(request.get).toHaveBeenCalledWith('/admin/pages/some-id', { deduplicateAcrossTabs: false, transferCache: false });
    expect(request.post).toHaveBeenCalledWith('/admin/pages', { slug: 'example', metadata });
    expect(request.patch).toHaveBeenCalledWith('/admin/pages/some-id/metadata', { metadata });
    expect(request.patch).toHaveBeenCalledWith('/admin/pages/some-id/draft', { document });
    expect(request.post).toHaveBeenCalledWith('/admin/pages/some-id/publish', {});
    expect(request.delete).toHaveBeenCalledWith('/admin/pages/some-id');
  });
});
