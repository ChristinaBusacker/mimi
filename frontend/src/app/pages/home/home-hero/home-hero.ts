import type { HeroType } from '@shared/twitch/twitch-status';

import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { I18nPipe } from '../../../core/i18n/i18n.pipe';
import { Icon } from '../../../components/icon/icon';
import { HomeHeroCountdown } from './home-hero-countdown';

/** Only the data needed by the home-specific hero, not the shared app-hero. */
export interface HomeHeroData {
  heroType: HeroType;
  icon: 'gaming' | 'heart' | 'music';
  titleKey: string;
  descriptionKey: string;
  typeKey: string;
  statusKey: string | null;
  actionKey: string;
  channelUrl: string | null;
  streamTitle: string | null;
  startsAt: string | null;
  scheduledAt: string | null;
  isLive: boolean;
  isUpcoming: boolean;
}

/** Builds a calendar draft. The one-hour end time is editable, not a claimed stream duration. */
export function homeStreamCalendarUrl(stream: HomeHeroData): string | null {
  if (!stream.isUpcoming || !stream.startsAt) {
    return null;
  }

  const start = Date.parse(stream.startsAt);
  if (!Number.isFinite(start)) {
    return null;
  }

  const formatUtc = (value: number): string =>
    new Date(value).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: stream.streamTitle || 'Mimishow',
    dates: `${formatUtc(start)}/${formatUtc(start + 60 * 60 * 1000)}`,
  });
  if (stream.channelUrl?.startsWith('https://www.twitch.tv/')) {
    params.set('details', stream.channelUrl);
  }
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

@Component({
  selector: 'app-home-hero',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AsyncPipe, HomeHeroCountdown, Icon, I18nPipe, RouterLink],
  templateUrl: './home-hero.html',
  styleUrl: './home-hero.scss',
})
export class HomeHero {
  readonly hero = input.required<HomeHeroData>();

  protected readonly calendarUrl = computed(() => homeStreamCalendarUrl(this.hero()));
}
