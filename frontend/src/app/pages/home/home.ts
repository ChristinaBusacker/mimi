import { AsyncPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';
import { Store } from '@ngxs/store';

import type {
  HeroType,
  TwitchStatus,
} from '@shared/twitch/twitch-status';

import { Button } from '../../components/button/button';
import { Icon } from '../../components/icon/icon';
import { VideoCard } from '../../components/video-card/video-card';
import { I18nPipe } from '../../core/i18n/i18n.pipe';
import { I18nState } from '../../core/i18n/i18n.state';
import type { Language } from '../../core/i18n/i18n.types';
import { TwitchState } from '../../core/twitch/twitch.state';
import { YouTubeState } from '../../core/youtube/youtube.state';

type HeroIcon = 'gaming' | 'heart' | 'music';

interface HeroViewModel {
  heroType: HeroType;
  icon: HeroIcon;
  titleKey: string;
  descriptionKey: string;
  typeKey: string;
  statusKey: string | null;
  actionKey: string;
  channelUrl: string | null;
  streamTitle: string | null;
  startsAt: string | null;
  isLive: boolean;
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AsyncPipe, Button, I18nPipe, Icon, VideoCard],
  selector: 'app-home',
  styleUrl: './home.scss',
  templateUrl: './home.html',
})
export class Home {
  private readonly store = inject(Store);

  private readonly twitchStatus = this.store.selectSignal(TwitchState.status);
  private readonly language = this.store.selectSignal(I18nState.language);

  protected readonly videos = this.store.selectSignal(YouTubeState.videos);

  protected readonly hero = computed(() =>
    this.createHeroViewModel(
      this.twitchStatus(),
      this.language(),
    ),
  );

  private createHeroViewModel(
    status: TwitchStatus | null,
    language: Language,
  ): HeroViewModel {
    const heroType =
      status && status.state !== 'none' && status.heroType
        ? status.heroType
        : 'music';

    const activeStatus =
      status && status.state !== 'none'
        ? status
        : null;

    return {
      heroType,
      icon: this.getHeroIcon(heroType),
      titleKey: `hero.${heroType}.title`,
      descriptionKey: `hero.${heroType}.description`,
      typeKey: `stream.type.${heroType}`,
      statusKey:
        status?.state === 'live'
          ? 'stream.status.live'
          : status?.state === 'upcoming'
            ? 'stream.status.upcoming'
            : null,
      actionKey:
        status?.state === 'live'
          ? 'hero.action.live'
          : 'hero.action.channel',
      channelUrl: status?.channelUrl ?? null,
      streamTitle: activeStatus?.title ?? null,
      startsAt:
        status?.state === 'upcoming'
          ? this.formatDateTime(status.startsAt, language)
          : null,
      isLive: status?.state === 'live',
    };
  }

  private getHeroIcon(heroType: HeroType): HeroIcon {
    if (heroType === 'chatting') {
      return 'heart';
    }

    return heroType;
  }

  private formatDateTime(value: string, language: Language): string {
    return new Intl.DateTimeFormat(
      language === 'de' ? 'de-DE' : 'en-US',
      {
        weekday: 'long',
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      },
    ).format(new Date(value));
  }
}
