import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SupportButton } from './support-button';

describe('SupportButton', () => {
  let fixture: ComponentFixture<SupportButton>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SupportButton],
    }).compileComponents();

    fixture = TestBed.createComponent(SupportButton);
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should render a button without an href', () => {
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector(
      'button',
    ) as HTMLButtonElement | null;

    expect(button).not.toBeNull();
  });

  it('should render an external link when an href is set', () => {
    fixture.componentRef.setInput('href', 'https://example.com/support');
    fixture.componentRef.setInput('target', '_blank');
    fixture.detectChanges();

    const link = fixture.nativeElement.querySelector(
      'a',
    ) as HTMLAnchorElement | null;

    expect(link?.getAttribute('href')).toBe('https://example.com/support');
    expect(link?.getAttribute('target')).toBe('_blank');
    expect(link?.getAttribute('rel')).toBe('noopener noreferrer');
  });
});
