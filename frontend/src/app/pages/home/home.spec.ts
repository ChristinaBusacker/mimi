import type { BlogPostSummary } from '@shared/blog/blog';

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

  const posts: BlogPostSummary[] = [
    {
      id: 'first', slug: 'first', title: 'First story', excerpt: 'A story',
      coverAssetId: null, coverImageDescription: null,
      publishedAt: '2026-10-01T12:00:00Z', updatedAt: '2026-10-01T12:00:00Z',
      author: { slug: 'mimi', displayName: 'Mimi', avatarAssetId: null },
      categories: [],
    },
    {
      id: 'second', slug: 'second', title: 'Second story', excerpt: 'Another story',
      coverAssetId: null, coverImageDescription: null,
      publishedAt: '2026-10-02T12:00:00Z', updatedAt: '2026-10-02T12:00:00Z',
      author: { slug: 'mimi', displayName: 'Mimi', avatarAssetId: null },
      categories: [],
    },
  ];

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
            getPosts: () => of(posts),
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
    expect(fixture.nativeElement.querySelector('.home-invite a[href="/community"]')).not.toBeNull();
  });

  it('previews articles without hiding their crawlable links', () => {
    fixture.detectChanges();

    const choices = fixture.nativeElement.querySelectorAll('.home-blog-topics__item') as NodeListOf<HTMLButtonElement>;
    expect(choices.length).toBe(2);
    choices[1].click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.home-blog-feature h3')?.textContent).toContain('Second story');
    expect(fixture.nativeElement.querySelectorAll('.home-blog-topics__link').length).toBe(2);
  });
});
