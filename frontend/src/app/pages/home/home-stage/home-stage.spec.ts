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

  it('exposes three accessible world selectors and a non-WebGL fallback', () => {
    const choices = fixture.nativeElement.querySelectorAll('.stage__choice') as NodeListOf<HTMLButtonElement>;
    expect(choices.length).toBe(3);
    expect(choices[0].getAttribute('aria-pressed')).toBe('true');
    expect(fixture.nativeElement.querySelectorAll('.stage__fallback-island').length).toBe(3);
    expect(fixture.nativeElement.querySelector('a[href="/music"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelectorAll('.stage__island-label').length).toBe(3);
    expect(fixture.nativeElement.querySelector('.stage__spotlight')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.stage__details')).toBeNull();
  });

  it('updates details and navigation when selecting a different world', () => {
    const buttons = fixture.nativeElement.querySelectorAll('.stage__choice') as NodeListOf<HTMLButtonElement>;
    buttons[2].click();
    fixture.detectChanges();
    expect(buttons[2].getAttribute('aria-pressed')).toBe('true');
    expect(fixture.nativeElement.querySelector('a[href="/gaming"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.stage--gaming')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.stage__island-label[data-world="gaming"].is-active')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('a[href="/music"]')).toBeNull();
  });

  it('supports previous and next controls without WebGL', () => {
    const arrows = fixture.nativeElement.querySelectorAll('.stage__arrow') as NodeListOf<HTMLButtonElement>;
    arrows[1].click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('a[href="/community"]')).not.toBeNull();
    arrows[0].click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('a[href="/music"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelectorAll('.stage__island-label').length).toBe(3);
    expect(fixture.nativeElement.querySelector('.stage__spotlight')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.stage__details')).toBeNull();
  });
});
