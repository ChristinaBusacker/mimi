import type {
  CommunityDiscordRoleCatalog,
  CommunityDiscordRoleDefinition,
  SaveCommunityDiscordRoleDefinition,
} from '@shared/community/community-discord';
import type {
  CommunityAchievementDefinition,
} from '@shared/community/community-progression';

import {
  Injectable,
  inject,
} from '@angular/core';
import type { Observable } from 'rxjs';

import { RequestService } from '../http/request.service';

export interface DiscordRoleProvisioningResult {
  total: number;
  enabled: number;
  created: number;
  updated: number;
  unchanged: number;
  skippedDisabled: number;
  failed: number;
}

@Injectable({
  providedIn: 'root',
})
export class AdminCommunityDiscordRolesService {
  private readonly request =
    inject(RequestService);

  getDefinitions(): Observable<
    CommunityDiscordRoleDefinition[]
  > {
    return this.request.get<
      CommunityDiscordRoleDefinition[]
    >(
      '/admin/community/discord/community-roles',
      {
        deduplicateAcrossTabs: false,
        transferCache: false,
      },
    );
  }

  getRoleCatalog():
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

  getAchievements(): Observable<
    CommunityAchievementDefinition[]
  > {
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

  saveDefinition(
    key: string,
    input: SaveCommunityDiscordRoleDefinition,
  ): Observable<CommunityDiscordRoleDefinition> {
    return this.request.put<
      CommunityDiscordRoleDefinition,
      SaveCommunityDiscordRoleDefinition
    >(
      `/admin/community/discord/community-roles/${encodeURIComponent(key)}`,
      input,
    );
  }

  synchronize(): Observable<
    DiscordRoleProvisioningResult | null
  > {
    return this.request.post<
      DiscordRoleProvisioningResult | null,
      Record<string, never>
    >(
      '/admin/community/discord/community-roles/sync',
      {},
    );
  }
}
