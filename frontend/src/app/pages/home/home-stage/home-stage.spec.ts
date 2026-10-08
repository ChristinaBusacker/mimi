import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideStore } from '@ngxs/store';
import { of } from 'rxjs';

import { GamingService } from '../../../core/gaming/gaming.service';
import { I18nState } from '../../../core/i18n/i18n.state';
import { MusicPublicService } from '../../../core/music/music-public.service';
import { HomeStage } from './home-stage';

describe('HomeStage', () => {
  let fixture: ComponentFixture<HomeStage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HomeStage],
      providers: [
        provideRouter([]),
        provideStore([I18nState]),
        { provide: MusicPublicService, useValue: { getAlbums: () => of([]) } },
        { provide: GamingService, useValue: { getNextStream: () => of({ stream: null, game: null }) } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(HomeStage);
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('renders three accessible, selectable islands', () => {
    const islands = fixture.nativeElement.querySelectorAll('.stage__world-select') as NodeListOf<HTMLButtonElement>;

    expect(islands.length).toBe(3);
    expect(fixture.nativeElement.querySelector('.stage__world--music .stage__world-select').getAttribute('aria-pressed')).toBe('true');
    expect(fixture.nativeElement.querySelector('a[href="/music"]')).not.toBeNull();
  });

  it('brings the selected island to the center and updates the destination', () => {
    const gaming = fixture.nativeElement.querySelector('.stage__world--gaming .stage__world-select') as HTMLButtonElement;
    gaming.click();
    fixture.detectChanges();

    expect(gaming.getAttribute('aria-pressed')).toBe('true');
    expect(fixture.nativeElement.querySelector('.stage__world--gaming').classList.contains('stage__world--center')).toBe(true);
    expect(fixture.nativeElement.querySelector('a[href="/gaming"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('a[href="/music"]')).toBeNull();
  });

  it('uses existing localization keys instead of unreleased stage keys', () => {
    expect(fixture.nativeElement.textContent).not.toContain('home.stage.');
  });
});
