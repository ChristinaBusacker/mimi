import type {
  CommunityDashboard,
} from '@shared/community/community-dashboard';

import {
  AsyncPipe,
} from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  signal,
} from '@angular/core';
import {
  RouterLink,
} from '@angular/router';
import {
  Store,
} from '@ngxs/store';
import {
  firstValueFrom,
} from 'rxjs';

import { LoadAuthSession } from '../../core/auth/auth.actions';
import { AuthState } from '../../core/auth/auth.state';
import { CommunityDashboardService } from '../../core/community/community-dashboard.service';
import { I18nPipe } from '../../core/i18n/i18n.pipe';

@Component({
  changeDetection:
    ChangeDetectionStrategy.OnPush,
  imports: [
    AsyncPipe,
    I18nPipe,
    RouterLink,
  ],
  selector: 'app-community-page',
  styleUrl: './community.scss',
  templateUrl: './community.html',
})
export class CommunityPage {
  private readonly store = inject(Store);
  private readonly dashboardService =
    inject(CommunityDashboardService);

  private loadedUserUuid: string | null =
    null;

  protected readonly user =
    this.store.selectSignal(
      AuthState.user,
    );
  protected readonly authInitialized =
    this.store.selectSignal(
      AuthState.initialized,
    );
  protected readonly membershipState =
    signal<CommunityDashboard | null>(
      null,
    );
  protected readonly loadingState =
    signal(false);

  constructor() {
    this.store.dispatch(
      new LoadAuthSession(),
    ).subscribe();

    effect(() => {
      const initialized =
        this.authInitialized();
      const user = this.user();

      if (!initialized) {
        return;
      }

      if (!user) {
        this.membershipState.set(null);
        this.loadedUserUuid = null;
        this.loadingState.set(false);

        return;
      }

      if (
        this.loadedUserUuid ===
        user.uuid
      ) {
        return;
      }

      this.loadedUserUuid = user.uuid;
      void this.loadMembershipState();
    });
  }

  private async loadMembershipState():
    Promise<void> {
    this.loadingState.set(true);

    try {
      this.membershipState.set(
        await firstValueFrom(
          this.dashboardService
            .getDashboard(),
        ),
      );
    } finally {
      this.loadingState.set(false);
    }
  }
}
