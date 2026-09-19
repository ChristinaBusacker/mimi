import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type CloudDirection = 'left' | 'right';

@Component({
  selector: 'app-cloud-background',
  templateUrl: './cloud-background.html',
  styleUrl: './cloud-background.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CloudBackground {
  readonly src = input.required<string>();

  readonly top = input('20%');
  readonly width = input('300px');

  readonly duration = input(180);
  readonly delay = input(0);

  readonly opacity = input(1);
  readonly offsetY = input('0px');

  readonly direction = input<CloudDirection>('left');
}
