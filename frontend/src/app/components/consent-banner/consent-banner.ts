import { AsyncPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  afterNextRender,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';

import { I18nPipe } from '../../core/i18n/i18n.pipe';
import { ConsentService } from '../../core/privacy/consent.service';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AsyncPipe, I18nPipe, RouterLink],
  selector: 'app-consent-banner',
  styleUrl: './consent-banner.scss',
  templateUrl: './consent-banner.html',
})
export class ConsentBanner {
  protected readonly consent = inject(ConsentService);
  protected readonly clientReady = signal(false);
  protected readonly analyticsSelected = signal(false);

  constructor() {
    afterNextRender({
      write: () => {
        this.analyticsSelected.set(this.consent.currentPreferences().analytics);
        this.clientReady.set(true);
      },
    });
  }

  protected acceptAll(): void {
    this.analyticsSelected.set(true);
    this.consent.acceptAll();
  }

  protected rejectOptional(): void {
    this.analyticsSelected.set(false);
    this.consent.rejectOptional();
  }

  protected openSettings(): void {
    this.analyticsSelected.set(this.consent.currentPreferences().analytics);
    this.consent.openSettings();
  }

  protected saveSettings(): void {
    this.consent.update({
      analytics: this.analyticsSelected(),
    });
  }

  protected cancelSettings(): void {
    this.analyticsSelected.set(this.consent.currentPreferences().analytics);
    this.consent.closeSettings();
  }

  protected setAnalytics(event: Event): void {
    if (event.target instanceof HTMLInputElement) {
      this.analyticsSelected.set(event.target.checked);
    }
  }
}
