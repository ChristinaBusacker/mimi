import type { GamingLocale, GamingNextStream } from '@shared/gaming/gaming';

import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { Store } from '@ngxs/store';
import { distinctUntilChanged, of, switchMap } from 'rxjs';

import { Carousel, type CarouselBreakpoints } from '../../components/carousel/carousel';
import { CarouselSlide } from '../../components/carousel/carousel-slide.directive';
import { Button } from '../../components/button/button';
import { Countdown } from '../../components/countdown/countdown';
import { Hero } from '../../components/hero/hero';
import { Icon } from '../../components/icon/icon';
import { LightboxDirective } from '../../components/lightbox/lightbox.directive';
import { GamingService } from '../../core/gaming/gaming.service';
import { I18nPipe } from '../../core/i18n/i18n.pipe';
import { I18nState } from '../../core/i18n/i18n.state';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AsyncPipe,
    Button,
    Carousel,
    CarouselSlide,
    Countdown,
    Hero,
    Icon,
    I18nPipe,
    LightboxDirective,
  ],
  selector: 'app-gaming',
  styleUrl: './gaming.scss',
  templateUrl: './gaming.html',
})
export class Gaming {
  private readonly route = inject(ActivatedRoute);
  private readonly store = inject(Store);
  private readonly gaming = inject(GamingService);

  private readonly initialData = this.route.snapshot.data['data'] as GamingNextStream;

  private readonly language = this.store.selectSignal(I18nState.language);

  private readonly initialLanguage = this.store.selectSnapshot(I18nState.language) as GamingLocale;

  protected readonly screenshotBreakpoints: CarouselBreakpoints = {
    900: {
      perView: 1.5,
    },
    560: {
      perView: 1.25,
      gap: 10,
    },
  };

  protected readonly data = toSignal(
    toObservable(this.language).pipe(
      distinctUntilChanged(),
      switchMap((locale) => {
        const gamingLocale = locale as GamingLocale;

        return gamingLocale === this.initialLanguage
          ? of(this.initialData)
          : this.gaming.getNextStream(gamingLocale);
      }),
    ),
    {
      initialValue: this.initialData,
    },
  );

  protected readonly locale = this.language;

  protected formatDateTime(value: string): string {
    return new Intl.DateTimeFormat(this.locale() === 'de' ? 'de-DE' : 'en-US', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));
  }
}
