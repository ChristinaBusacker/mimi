import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideStore } from '@ngxs/store';

import { I18nState } from '../../../core/i18n/i18n.state';
import { HomeHero, type HomeHeroData } from './home-hero';

const upcoming: HomeHeroData = {
  heroType: 'gaming',
  icon: 'gaming',
  titleKey: 'hero.gaming.title',
  descriptionKey: 'hero.gaming.description',
  typeKey: 'stream.type.gaming',
  statusKey: 'stream.status.upcoming',
  actionKey: 'hero.action.channel',
  channelUrl: 'https://www.twitch.tv/mimishow',
  streamTitle: 'Teststream',
  startsAt: '2026-10-13T18:00:00.000Z',
  scheduledAt: '13.10.2026, 20:00',
  isLive: false,
  isUpcoming: true,
};

describe('HomeHero', () => {
  let fixture: ComponentFixture<HomeHero>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HomeHero],
      providers: [provideRouter([]), provideStore([I18nState])],
    }).compileComponents();
    fixture = TestBed.createComponent(HomeHero);
  });

  it('renders a home-specific upcoming hero with four countdown units', () => {
    fixture.componentRef.setInput('hero', upcoming);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('app-home-hero-countdown')).not.toBeNull();
    expect(fixture.nativeElement.querySelectorAll('.home-countdown__unit').length).toBe(4);
    expect(fixture.nativeElement.querySelector('a.home-hero__calendar')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('app-hero')).toBeNull();
  });

  it('shows a live state without an upcoming countdown', () => {
    fixture.componentRef.setInput('hero', {
      ...upcoming,
      startsAt: null,
      isUpcoming: false,
      isLive: true,
      statusKey: 'stream.status.live',
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.home-hero__live-status')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('app-home-hero-countdown')).toBeNull();
    expect(fixture.nativeElement.querySelector('.home-hero__calendar')).toBeNull();
  });
});
