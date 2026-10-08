import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { I18nPipe } from '../../core/i18n/i18n.pipe';
import { PwaUpdateService } from '../../core/pwa/pwa-update.service';

@Component({
  selector: 'app-pwa-update-banner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AsyncPipe, I18nPipe],
  styleUrl: './pwa-update-banner.scss',
  templateUrl: './pwa-update-banner.html',
})
export class PwaUpdateBanner {
  protected readonly updates = inject(PwaUpdateService);
}
