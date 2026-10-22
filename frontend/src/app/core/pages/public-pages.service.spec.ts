import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { RequestService } from '../http/request.service';
import { PublicPagesService } from './public-pages.service';

describe('PublicPagesService', () => {
  it('reads the published endpoint, never admin drafts', () => {
    const get = vi.fn().mockReturnValue(of({}));
    TestBed.configureTestingModule({ providers: [{ provide: RequestService, useValue: { get } }] });
    TestBed.inject(PublicPagesService).getPublished('my-page').subscribe();
    expect(get).toHaveBeenCalledWith('/pages/my-page');
  });
});
