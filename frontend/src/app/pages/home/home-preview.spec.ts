import { convertToParamMap } from '@angular/router';

import { createTwitchPreview, createVideoPreview } from './home-preview';

describe('home preview', () => {
  it('creates a live gaming preview', () => {
    const status = createTwitchPreview(
      convertToParamMap({
        hero: 'live',
        heroType: 'gaming',
      }),
      null,
    );

    expect(status?.state).toBe('live');

    if (status?.state === 'live') {
      expect(status.heroType).toBe('gaming');
    }
  });

  it('does not override Twitch without a valid hero preview', () => {
    const status = createTwitchPreview(
      convertToParamMap({
        hero: 'invalid',
      }),
      null,
    );

    expect(status).toBeNull();
  });

  it('creates video preview data on demand', () => {
    const videos = createVideoPreview(
      convertToParamMap({
        previewVideos: '1',
      }),
    );

    expect(videos).toHaveLength(3);
  });
});
