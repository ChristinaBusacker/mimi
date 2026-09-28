import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideStore } from '@ngxs/store';
import { of } from 'rxjs';

import { RequestService } from '../../core/http/request.service';
import { I18nState } from '../../core/i18n/i18n.state';
import { Contact } from './contact';

describe('Contact', () => {
  let component: Contact;
  let fixture: ComponentFixture<Contact>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Contact],
      providers: [
        provideRouter([]),
        provideStore([I18nState]),
        {
          provide: RequestService,
          useValue: {
            post: () => of(undefined),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Contact);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
