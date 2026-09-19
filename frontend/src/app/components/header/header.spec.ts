import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideStore } from '@ngxs/store';

import { I18nState } from '../../core/i18n/i18n.state';
import { Header } from './header';

describe('Header', () => {
  let component: Header;
  let fixture: ComponentFixture<Header>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Header],
      providers: [
        provideRouter([]),
        provideStore([I18nState]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Header);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  afterEach(() => {
    fixture.destroy();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should toggle the mobile menu', () => {
    const button = fixture.nativeElement.querySelector(
      '.menu-toggle',
    ) as HTMLButtonElement;

    button.click();
    fixture.detectChanges();

    expect(button.getAttribute('aria-expanded')).toBe('true');

    button.click();
    fixture.detectChanges();

    expect(button.getAttribute('aria-expanded')).toBe('false');
  });
});
