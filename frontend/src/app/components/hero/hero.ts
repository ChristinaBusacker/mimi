import type { HeroType } from '@shared/twitch/twitch-status';

import {
  ChangeDetectionStrategy,
  Component,
  input,
} from '@angular/core';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-hero',
  styleUrl: './hero.scss',
  templateUrl: './hero.html',
})
export class Hero {
  readonly type = input<HeroType>('music');
}
