import type { HomeHeroData } from './home-hero';

import { homeStreamCalendarUrl } from './home-hero';

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

describe('home hero calendar', () => {
  it('creates a calendar draft with the correct instant', () => {
    const result = homeStreamCalendarUrl(upcoming);
    expect(result).not.toBeNull();
    const url = new URL(result!);
    expect(url.hostname).toBe('calendar.google.com');
    expect(url.searchParams.get('dates')).toBe('20261013T180000Z/20261013T190000Z');
    expect(url.searchParams.get('text')).toBe('Teststream');
  });

  it('does not offer a calendar event for live or unknown streams', () => {
    expect(homeStreamCalendarUrl({ ...upcoming, isLive: true, isUpcoming: false })).toBeNull();
    expect(homeStreamCalendarUrl({ ...upcoming, startsAt: 'invalid' })).toBeNull();
  });
});
