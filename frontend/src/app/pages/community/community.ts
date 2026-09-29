import type { CommunityDashboard } from '@shared/community/community-dashboard';
import type { CommunityPublicSummary } from '@shared/community/community-public';

import { AsyncPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  afterNextRender,
  effect,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { Store } from '@ngxs/store';
import { firstValueFrom } from 'rxjs';

import { Button } from '../../components/button/button';
import { Hero } from '../../components/hero/hero';
import { LoadAuthSession } from '../../core/auth/auth.actions';
import { AuthState } from '../../core/auth/auth.state';
import { CommunityDashboardService } from '../../core/community/community-dashboard.service';
import { CommunityPublicService } from '../../core/community/community-public.service';
import { I18nPipe } from '../../core/i18n/i18n.pipe';
import { Icon } from '../../components/icon/icon';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AsyncPipe, Button, Hero, I18nPipe, RouterLink, Icon],
  selector: 'app-community-page',
  styleUrl: './community.scss',
  templateUrl: './community.html',
})
export class CommunityPage {
  private readonly store = inject(Store);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dashboardService = inject(CommunityDashboardService);
  private readonly publicService = inject(CommunityPublicService);
  private loadedUserUuid: string | null = null;

  protected readonly user = this.store.selectSignal(AuthState.user);
  protected readonly authInitialized = this.store.selectSignal(AuthState.initialized);
  protected readonly membershipState = signal<CommunityDashboard | null>(null);
  protected readonly summary = signal<CommunityPublicSummary | null>(null);
  protected readonly loadingState = signal(false);

  constructor() {
    void this.loadSummary();

    afterNextRender(() => {
      const intervalId = window.setInterval(() => void this.loadSummary(), 30_000);

      this.destroyRef.onDestroy(() => window.clearInterval(intervalId));
    });

    this.store.dispatch(new LoadAuthSession()).subscribe();

    effect(() => {
      const initialized = this.authInitialized();
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

      if (this.loadedUserUuid === user.uuid) {
        return;
      }

      this.loadedUserUuid = user.uuid;
      void this.loadMembershipState();
    });
  }

  protected inviteUrl(): string | null {
    return this.summary()?.discord.inviteUrl ?? null;
  }

  private async loadSummary(): Promise<void> {
    try {
      this.summary.set(await firstValueFrom(this.publicService.getSummary()));
    } catch {
      this.summary.set(null);
    }
  }

  private async loadMembershipState(): Promise<void> {
    this.loadingState.set(true);

    try {
      this.membershipState.set(await firstValueFrom(this.dashboardService.getDashboard()));
    } finally {
      this.loadingState.set(false);
    }
  }
}
