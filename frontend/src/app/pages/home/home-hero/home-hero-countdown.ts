import { AsyncPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  afterNextRender,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';

import { I18nPipe } from '../../../core/i18n/i18n.pipe';

const SECOND_MS = 1000;
const MINUTE_SECONDS = 60;
const HOUR_SECONDS = 60 * MINUTE_SECONDS;
const DAY_SECONDS = 24 * HOUR_SECONDS;

export interface HomeCountdownParts {
  days: string;
  hours: string;
  minutes: string;
  seconds: string;
  hasStarted: boolean;
}

/** Keeps the four visible countdown units stable, including during the final seconds. */
export function createHomeCountdownParts(startsAt: string, now: number): HomeCountdownParts | null {
  const start = Date.parse(startsAt);
  if (!Number.isFinite(start)) {
    return null;
  }

  const remaining = Math.max(0, Math.ceil((start - now) / SECOND_MS));
  const twoDigits = (value: number): string => String(value).padStart(2, '0');

  return {
    days: twoDigits(Math.floor(remaining / DAY_SECONDS)),
    hours: twoDigits(Math.floor((remaining % DAY_SECONDS) / HOUR_SECONDS)),
    minutes: twoDigits(Math.floor((remaining % HOUR_SECONDS) / MINUTE_SECONDS)),
    seconds: twoDigits(remaining % MINUTE_SECONDS),
    hasStarted: remaining === 0,
  };
}

@Component({
  selector: 'app-home-hero-countdown',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AsyncPipe, I18nPipe],
  templateUrl: './home-hero-countdown.html',
  styleUrl: './home-hero-countdown.scss',
})
export class HomeHeroCountdown {
  readonly startsAt = input.required<string>();

  private readonly destroyRef = inject(DestroyRef);
  private readonly now = signal<number | null>(null);

  protected readonly countdown = computed(() => {
    const currentTime = this.now();
    return currentTime === null ? null : createHomeCountdownParts(this.startsAt(), currentTime);
  });

  constructor() {
    // Avoid rendering different countdown values during SSR and client hydration.
    afterNextRender(() => {
      this.now.set(Date.now());
      const timer = setInterval(() => this.now.set(Date.now()), SECOND_MS);
      this.destroyRef.onDestroy(() => clearInterval(timer));
    });
  }
}
