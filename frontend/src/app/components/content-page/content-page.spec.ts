import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideStore } from '@ngxs/store';

import { I18nState } from '../../core/i18n/i18n.state';
import { ContentPage } from './content-page';

describe('ContentPage', () => {
  let component: ContentPage;
  let fixture: ComponentFixture<ContentPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ContentPage],
      providers: [provideStore([I18nState])],
    }).compileComponents();

    fixture = TestBed.createComponent(ContentPage);
    fixture.componentRef.setInput('titleKey', 'footer.contact');
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
