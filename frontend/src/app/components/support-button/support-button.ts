import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { Icon } from '../icon/icon';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, NgTemplateOutlet],
  selector: 'app-support-button',
  styleUrl: './support-button.scss',
  templateUrl: './support-button.html',
})
export class SupportButton {
  readonly href = input<string | null>(null);
  readonly target = input<'_self' | '_blank'>('_self');
  readonly type = input<'button' | 'submit'>('button');
  readonly compact = input(false);
  readonly ariaLabel = input<string | null>(null);
}
