import type {
  CommunityDashboard,
} from '@shared/community/community-dashboard';

import {
  Injectable,
  inject,
} from '@angular/core';
import type {
  Observable,
} from 'rxjs';

import { RequestService } from '../http/request.service';

@Injectable({
  providedIn: 'root',
})
export class CommunityDashboardService {
  private readonly request =
    inject(RequestService);

  getDashboard():
    Observable<CommunityDashboard> {
    return this.request.get<
      CommunityDashboard
    >('/community/me', {
      deduplicateAcrossTabs: false,
      transferCache: false,
    });
  }

  disconnectTwitch():
    Observable<CommunityDashboard> {
    return this.request.delete<
      CommunityDashboard
    >('/community/twitch');
  }

  selectTitle(
    titleId: string | null,
  ): Observable<CommunityDashboard> {
    return this.request.put<
      CommunityDashboard,
      { titleId: string | null }
    >('/community/me/title', {
      titleId,
    });
  }

  selectProfileColor(
    achievementId: string | null,
  ): Observable<CommunityDashboard> {
    return this.request.put<
      CommunityDashboard,
      { achievementId: string | null }
    >('/community/me/profile-color', {
      achievementId,
    });
  }

  selectDiscordShowcaseRole(
    roleId: string | null,
  ): Observable<CommunityDashboard> {
    return this.request.put<
      CommunityDashboard,
      { roleId: string | null }
    >(
      '/community/me/discord-showcase-role',
      { roleId },
    );
  }

  setPinnedAchievements(
    achievementIds: string[],
  ): Observable<CommunityDashboard> {
    return this.request.put<
      CommunityDashboard,
      { achievementIds: string[] }
    >(
      '/community/me/pinned-achievements',
      {
        achievementIds,
      },
    );
  }
}
