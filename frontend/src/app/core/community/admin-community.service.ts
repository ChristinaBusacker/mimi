import type {
  CommunityBalancingDefaults,
} from '@shared/community/community-balancing';
import type {
  CommunityDiscordRoleCatalog,
} from '@shared/community/community-discord';
import type {
  CommunityEventRule,
  CommunityEventType,
  SaveCommunityEventRule,
} from '@shared/community/community-event';
import type {
  CommunityAchievementDefinition,
  CommunityAchievementMetric,
  CommunityLevelDefinition,
  CommunityTitleDefinition,
  SaveCommunityAchievementDefinition,
  SaveCommunityTitleDefinition,
} from '@shared/community/community-progression';

import {
  Injectable,
  inject,
} from '@angular/core';
import type { Observable } from 'rxjs';

import { RequestService } from '../http/request.service';

export interface CommunityEventTypeInfo {
  eventType: CommunityEventType;
  supportsContentLength: boolean;
}

export interface CommunityAchievementMetricInfo {
  metric: CommunityAchievementMetric;
  requiresEventType: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class AdminCommunityService {
  private readonly request =
    inject(RequestService);

  getDefaults():
    Observable<CommunityBalancingDefaults> {
    return this.request.get<
      CommunityBalancingDefaults
    >(
      '/admin/community/defaults',
      {
        deduplicateAcrossTabs: false,
        transferCache: false,
      },
    );
  }

  getDiscordRoles():
    Observable<CommunityDiscordRoleCatalog> {
    return this.request.get<
      CommunityDiscordRoleCatalog
    >(
      '/admin/community/discord/roles',
      {
        deduplicateAcrossTabs: false,
        transferCache: false,
      },
    );
  }

  getEventTypes():
    Observable<CommunityEventTypeInfo[]> {
    return this.request.get<
      CommunityEventTypeInfo[]
    >(
      '/admin/community/event-types',
      {
        deduplicateAcrossTabs: false,
        transferCache: false,
      },
    );
  }

  getEventRules():
    Observable<CommunityEventRule[]> {
    return this.request.get<
      CommunityEventRule[]
    >(
      '/admin/community/event-rules',
      {
        deduplicateAcrossTabs: false,
        transferCache: false,
      },
    );
  }

  saveEventRule(
    eventType: CommunityEventType,
    input: SaveCommunityEventRule,
  ): Observable<CommunityEventRule> {
    return this.request.put<
      CommunityEventRule,
      SaveCommunityEventRule
    >(
      `/admin/community/event-rules/${encodeURIComponent(eventType)}`,
      input,
    );
  }

  restoreEventRule(
    eventType: CommunityEventType,
  ): Observable<CommunityEventRule> {
    return this.request.post<
      CommunityEventRule,
      Record<string, never>
    >(
      `/admin/community/event-rules/${encodeURIComponent(eventType)}/restore-default`,
      {},
    );
  }

  getAchievementMetrics():
    Observable<CommunityAchievementMetricInfo[]> {
    return this.request.get<
      CommunityAchievementMetricInfo[]
    >(
      '/admin/community/achievement-metrics',
      {
        deduplicateAcrossTabs: false,
        transferCache: false,
      },
    );
  }

  getLevels():
    Observable<CommunityLevelDefinition[]> {
    return this.request.get<
      CommunityLevelDefinition[]
    >(
      '/admin/community/levels',
      {
        deduplicateAcrossTabs: false,
        transferCache: false,
      },
    );
  }

  saveLevels(
    requiredXp: number[],
  ): Observable<CommunityLevelDefinition[]> {
    return this.request.put<
      CommunityLevelDefinition[],
      { requiredXp: number[] }
    >(
      '/admin/community/levels',
      {
        requiredXp,
      },
    );
  }

  restoreLevels():
    Observable<CommunityLevelDefinition[]> {
    return this.request.post<
      CommunityLevelDefinition[],
      Record<string, never>
    >(
      '/admin/community/levels/restore-default',
      {},
    );
  }

  getTitles():
    Observable<CommunityTitleDefinition[]> {
    return this.request.get<
      CommunityTitleDefinition[]
    >(
      '/admin/community/titles',
      {
        deduplicateAcrossTabs: false,
        transferCache: false,
      },
    );
  }

  saveTitle(
    key: string,
    input: SaveCommunityTitleDefinition,
  ): Observable<CommunityTitleDefinition> {
    return this.request.put<
      CommunityTitleDefinition,
      SaveCommunityTitleDefinition
    >(
      `/admin/community/titles/${encodeURIComponent(key)}`,
      input,
    );
  }

  getAchievements():
    Observable<CommunityAchievementDefinition[]> {
    return this.request.get<
      CommunityAchievementDefinition[]
    >(
      '/admin/community/achievements',
      {
        deduplicateAcrossTabs: false,
        transferCache: false,
      },
    );
  }

  saveAchievement(
    key: string,
    input: SaveCommunityAchievementDefinition,
  ): Observable<CommunityAchievementDefinition> {
    return this.request.put<
      CommunityAchievementDefinition,
      SaveCommunityAchievementDefinition
    >(
      `/admin/community/achievements/${encodeURIComponent(key)}`,
      input,
    );
  }
}
