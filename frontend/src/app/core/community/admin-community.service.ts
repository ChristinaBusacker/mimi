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
  SaveCommunityLevelDefinition,
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

  saveLevel(
    level: number,
    input: SaveCommunityLevelDefinition,
  ): Observable<CommunityLevelDefinition> {
    return this.request.put<
      CommunityLevelDefinition,
      SaveCommunityLevelDefinition
    >(
      `/admin/community/levels/${level}`,
      input,
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
