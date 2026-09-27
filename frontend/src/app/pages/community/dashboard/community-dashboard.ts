import type {
  CommunityDashboard,
  CommunityDashboardAchievement,
  CommunityDashboardTitle,
} from '@shared/community/community-dashboard';
import type {
  CommunityLocalizedText,
} from '@shared/community/community-progression';

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
  FormsModule,
} from '@angular/forms';
import {
  RouterLink,
} from '@angular/router';
import {
  Store,
} from '@ngxs/store';
import {
  firstValueFrom,
} from 'rxjs';

import { LoadAuthSession } from '../../../core/auth/auth.actions';
import { AuthState } from '../../../core/auth/auth.state';
import { CommunityDashboardService } from '../../../core/community/community-dashboard.service';
import { I18nPipe } from '../../../core/i18n/i18n.pipe';
import { I18nState } from '../../../core/i18n/i18n.state';

@Component({
  changeDetection:
    ChangeDetectionStrategy.OnPush,
  imports: [
    AsyncPipe,
    FormsModule,
    I18nPipe,
    RouterLink,
  ],
  selector:
    'app-community-dashboard-page',
  styleUrl:
    './community-dashboard.scss',
  templateUrl:
    './community-dashboard.html',
})
export class CommunityDashboardPage {
  private readonly store = inject(Store);
  private readonly service =
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
  private readonly language =
    this.store.selectSignal(
      I18nState.language,
    );
  protected readonly dashboard =
    signal<CommunityDashboard | null>(
      null,
    );
  protected readonly loading =
    signal(false);
  protected readonly saving =
    signal(false);
  protected readonly errorKey =
    signal<string | null>(null);

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
        this.dashboard.set(null);
        this.loadedUserUuid = null;
        this.loading.set(false);
        return;
      }

      if (
        this.loadedUserUuid ===
        user.uuid
      ) {
        return;
      }

      this.loadedUserUuid = user.uuid;
      void this.loadDashboard();
    });
  }

  protected displayText(
    text: CommunityLocalizedText,
  ): string {
    return this.language() === 'en'
      ? text.en ?? text.de
      : text.de;
  }

  protected xpUntilNextLevel(
    dashboard: CommunityDashboard,
  ): number {
    if (!dashboard.nextLevel) {
      return 0;
    }

    return Math.max(
      0,
      dashboard.nextLevel.requiredXp -
        dashboard.totalXp,
    );
  }

  protected unlockedAchievements(
    dashboard: CommunityDashboard,
  ): CommunityDashboardAchievement[] {
    return dashboard.achievements.filter(
      (achievement) =>
        achievement.unlocked,
    );
  }

  protected pinnedAchievements(
    dashboard: CommunityDashboard,
  ): CommunityDashboardAchievement[] {
    const pinnedIds = new Set(
      dashboard.customization
        ?.pinnedAchievementIds ?? [],
    );

    return dashboard.achievements.filter(
      (achievement) =>
        pinnedIds.has(
          achievement.id,
        ),
    );
  }

  protected selectedTitle(
    dashboard: CommunityDashboard,
  ): CommunityDashboardTitle | null {
    const selectedTitleId =
      dashboard.customization
        ?.selectedTitleId;

    if (!selectedTitleId) {
      return null;
    }

    return (
      dashboard.titles.find(
        (title) =>
          title.id ===
          selectedTitleId,
      ) ?? null
    );
  }

  protected async selectTitle(
    titleId: string | null,
  ): Promise<void> {
    await this.save(() =>
      this.service.selectTitle(
        titleId || null,
      ),
    );
  }

  protected async selectProfileColor(
    achievementId: string | null,
  ): Promise<void> {
    await this.save(() =>
      this.service.selectProfileColor(
        achievementId || null,
      ),
    );
  }

  protected async togglePinned(
    achievement:
      CommunityDashboardAchievement,
  ): Promise<void> {
    const dashboard = this.dashboard();

    if (
      !dashboard ||
      !achievement.unlocked
    ) {
      return;
    }

    const current = [
      ...(
        dashboard.customization
          ?.pinnedAchievementIds ?? []
      ),
    ];
    const index = current.indexOf(
      achievement.id,
    );

    if (index >= 0) {
      current.splice(index, 1);
    } else {
      if (current.length >= 3) {
        this.errorKey.set(
          'community.dashboard.pinLimit',
        );
        return;
      }

      current.push(achievement.id);
    }

    await this.save(() =>
      this.service.setPinnedAchievements(
        current,
      ),
    );
  }

  private async loadDashboard():
    Promise<void> {
    this.loading.set(true);
    this.errorKey.set(null);

    try {
      this.dashboard.set(
        await firstValueFrom(
          this.service.getDashboard(),
        ),
      );
    } catch {
      this.errorKey.set(
        'community.dashboard.loadFailed',
      );
    } finally {
      this.loading.set(false);
    }
  }

  private async save(
    action: () => ReturnType<
      CommunityDashboardService['getDashboard']
    >,
  ): Promise<void> {
    this.saving.set(true);
    this.errorKey.set(null);

    try {
      this.dashboard.set(
        await firstValueFrom(
          action(),
        ),
      );
    } catch {
      this.errorKey.set(
        'community.dashboard.saveFailed',
      );
    } finally {
      this.saving.set(false);
    }
  }
}
