import { ComponentFixture, TestBed } from '@angular/core/testing';

import type { YouTubeVideo } from '@shared/youtube/youtube-video';

import { VideoCard } from './video-card';

describe('VideoCard', () => {
  let component: VideoCard;
  let fixture: ComponentFixture<VideoCard>;

  const video: YouTubeVideo = {
    id: 'video-id',
    url: 'https://www.youtube.com/watch?v=video-id',
    title: 'Video title',
    description: 'Video description',
    descriptionExcerpt: 'Video description',
    thumbnailUrl: 'https://example.com/thumbnail.jpg',
    durationSeconds: 125,
    publishedAt: '2026-09-19T18:00:00.000Z',
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VideoCard],
    }).compileComponents();

    fixture = TestBed.createComponent(VideoCard);
    fixture.componentRef.setInput('video', video);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
