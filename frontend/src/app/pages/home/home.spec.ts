import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideStore } from '@ngxs/store';
import { of } from 'rxjs';

import { BlogPublicService } from '../../core/blog/blog-public.service';
import { GamingService } from '../../core/gaming/gaming.service';
import { I18nState } from '../../core/i18n/i18n.state';
import { MusicPublicService } from '../../core/music/music-public.service';
import { TwitchState } from '../../core/twitch/twitch.state';
import { YouTubeState } from '../../core/youtube/youtube.state';
import { Home } from './home';

describe('Home', () => {
  let component: Home;
  let fixture: ComponentFixture<Home>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Home],
      providers: [
        provideRouter([]),
        provideStore([
          I18nState,
          TwitchState,
          YouTubeState,
        ]),
        {
          provide: BlogPublicService,
          useValue: {
            getPosts: () => of([]),
          },
        },
        { provide: MusicPublicService, useValue: { getAlbums: () => of([]) } },
        { provide: GamingService, useValue: { getNextStream: () => of({ stream: null, game: null }) } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Home);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
