import { RESPONSE_INIT } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { NotFoundPage } from './not-found';

describe('NotFoundPage', () => {
  it('sets a 404 status during server rendering', async () => {
    const responseInit: ResponseInit = {};

    await TestBed.configureTestingModule({
      imports: [NotFoundPage],
      providers: [
        {
          provide: RESPONSE_INIT,
          useValue: responseInit,
        },
      ],
    })
      .overrideComponent(NotFoundPage, {
        set: {
          imports: [],
          template: '',
        },
      })
      .compileComponents();

    TestBed.createComponent(NotFoundPage);

    expect(responseInit.status).toBe(404);
  });
});
