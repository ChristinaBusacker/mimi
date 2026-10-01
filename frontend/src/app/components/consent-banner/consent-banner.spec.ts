import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideStore } from '@ngxs/store';

import { I18nState } from '../../core/i18n/i18n.state';
import { ConsentBanner } from './consent-banner';

describe('ConsentBanner', () => {
  let component: ConsentBanner;
  let fixture: ComponentFixture<ConsentBanner>;

  beforeEach(async () => {
    localStorage.clear();

    await TestBed.configureTestingModule({
      imports: [ConsentBanner],
      providers: [
        provideRouter([]),
        provideStore([I18nState]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ConsentBanner);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
