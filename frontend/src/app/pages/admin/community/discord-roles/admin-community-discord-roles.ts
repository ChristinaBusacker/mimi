import type {
  CommunityDiscordRoleCatalog,
  CommunityDiscordRoleDefinition,
  CommunityDiscordRoleKind,
  SaveCommunityDiscordRoleDefinition,
} from '@shared/community/community-discord';
import type {
  CommunityAchievementDefinition,
} from '@shared/community/community-progression';

import { AsyncPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom, forkJoin } from 'rxjs';

import { Button } from '../../../../components/button/button';
import {
  AdminCommunityDiscordRolesService,
  type DiscordRoleProvisioningResult,
} from '../../../../core/community/admin-community-discord-roles.service';
import { I18nPipe } from '../../../../core/i18n/i18n.pipe';

type DiscordRoleStatus =
  | 'disabled'
  | 'disconnected'
  | 'missing'
  | 'not-configured'
  | 'pending'
  | 'synced';

interface DiscordRoleDraft {
  clientId: string;
  id: string | null;
  key: string;
  persisted: boolean;
  kind: CommunityDiscordRoleKind;
  name: string;
  color: string;
  hasColor: boolean;
  enabled: boolean;
  discordRoleId: string | null;
  provisionedByCommunity: boolean;
  achievementId: string | null;
  minimumLevel: number | null;
  maximumLevel: number | null;
  sortOrder: number;
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AsyncPipe,
    Button,
    FormsModule,
    I18nPipe,
  ],
  selector: 'app-admin-community-discord-roles',
  styleUrl: './admin-community-discord-roles.scss',
  templateUrl: './admin-community-discord-roles.html',
})
export class AdminCommunityDiscordRoles
  implements OnInit
{
  private readonly service = inject(
    AdminCommunityDiscordRolesService,
  );

  protected readonly loading = signal(true);
  protected readonly syncing = signal(false);
  protected readonly savingKey = signal<
    string | null
  >(null);
  protected readonly statusKey = signal<
    string | null
  >(null);
  protected readonly pendingDeleteId = signal<
    string | null
  >(null);
  protected readonly catalog = signal<
    CommunityDiscordRoleCatalog
  >({
    configured: false,
    connected: false,
    roles: [],
  });
  protected readonly roles = signal<
    DiscordRoleDraft[]
  >([]);
  protected readonly achievements = signal<
    CommunityAchievementDefinition[]
  >([]);
  protected readonly lastSync = signal<
    DiscordRoleProvisioningResult | null
  >(null);

  async ngOnInit(): Promise<void> {
    await this.reload();
  }

  protected createRole(): void {
    const firstAchievement =
      this.achievements()[0] ?? null;
    const sortOrder =
      Math.max(
        -10,
        ...this.roles().map(
          (role) => role.sortOrder,
        ),
      ) + 10;

    this.roles.update((roles) => [
      ...roles,
      {
        clientId:
          `new-${Date.now()}-${roles.length}`,
        id: null,
        key: '',
        persisted: false,
        kind: 'showcase',
        name: '',
        color: '#5865f2',
        hasColor: false,
        enabled: true,
        discordRoleId: null,
        provisionedByCommunity: false,
        achievementId:
          firstAchievement?.id ?? null,
        minimumLevel: null,
        maximumLevel: null,
        sortOrder,
      },
    ]);

    this.statusKey.set(null);
  }

  protected discardRole(
    role: DiscordRoleDraft,
  ): void {
    if (role.persisted) {
      return;
    }

    this.roles.update((roles) =>
      roles.filter(
        (candidate) => candidate !== role,
      ),
    );
  }

  protected roleKindChanged(
    role: DiscordRoleDraft,
  ): void {
    switch (role.kind) {
      case 'level-range':
        role.achievementId = null;
        role.minimumLevel ??= 1;
        role.maximumLevel = null;
        break;
      case 'showcase':
        role.minimumLevel = null;
        role.maximumLevel = null;
        role.achievementId ??=
          this.achievements()[0]?.id ?? null;
        break;
      case 'special':
        role.achievementId = null;
        role.minimumLevel = null;
        role.maximumLevel = null;
        break;
    }
  }

  protected roleKindLabelKey(
    kind: CommunityDiscordRoleKind,
  ): string {
    return `admin.community.discordRoles.kind.${kind}`;
  }

  protected roleKindHintKey(
    kind: CommunityDiscordRoleKind,
  ): string {
    return `admin.community.discordRoles.kindHint.${kind}`;
  }

  protected roleStatusKey(
    role: DiscordRoleDraft,
  ): string {
    return `admin.community.discordRoles.status.${this.roleStatus(role)}`;
  }

  protected roleStatusClass(
    role: DiscordRoleDraft,
  ): string {
    return `status-${this.roleStatus(role)}`;
  }

  protected isRoleValid(
    role: DiscordRoleDraft,
  ): boolean {
    if (
      role.name.trim().length === 0 ||
      role.name.trim().length > 100 ||
      !Number.isSafeInteger(role.sortOrder) ||
      (
        role.hasColor &&
        !/^#[0-9a-f]{6}$/i.test(
          role.color,
        )
      )
    ) {
      return false;
    }

    switch (role.kind) {
      case 'level-range':
        return (
          this.isPositiveInteger(
            role.minimumLevel,
          ) &&
          (
            role.maximumLevel === null ||
            (
              this.isPositiveInteger(
                role.maximumLevel,
              ) &&
              role.maximumLevel >=
                role.minimumLevel!
            )
          ) &&
          !this.hasLevelOverlap(role)
        );
      case 'showcase':
        return role.achievementId !== null;
      case 'special':
        return true;
    }
  }

  protected async saveRole(
    role: DiscordRoleDraft,
  ): Promise<void> {
    if (!this.isRoleValid(role)) {
      this.statusKey.set(
        'admin.community.discordRoles.invalid',
      );
      return;
    }

    const key = role.persisted
      ? role.key
      : this.uniqueRoleKey(role);

    this.savingKey.set(role.clientId);
    this.statusKey.set(null);

    try {
      await firstValueFrom(
        this.service.saveDefinition(
          key,
          this.roleInput(role),
        ),
      );
    } catch {
      this.statusKey.set(
        'admin.community.discordRoles.saveFailed',
      );
      this.savingKey.set(null);
      return;
    }

    const syncResult =
      await this.trySynchronize();

    try {
      await this.refreshRoleState();
      this.setSaveStatus(syncResult);
    } catch {
      this.statusKey.set(
        'admin.community.discordRoles.savedRefreshFailed',
      );
    } finally {
      this.savingKey.set(null);
    }
  }

  protected requestDeleteRole(
    role: DiscordRoleDraft,
  ): void {
    if (!role.persisted || !role.id) {
      return;
    }

    this.pendingDeleteId.set(role.id);
    this.statusKey.set(null);
  }

  protected cancelDeleteRole(): void {
    this.pendingDeleteId.set(null);
  }

  protected async deleteRole(
    role: DiscordRoleDraft,
  ): Promise<void> {
    if (!role.persisted || !role.id) {
      return;
    }

    this.savingKey.set(role.clientId);
    this.statusKey.set(null);

    try {
      await firstValueFrom(
        this.service.deleteDefinition(
          role.id,
        ),
      );
      this.pendingDeleteId.set(null);
      await this.refreshRoleState();
      this.statusKey.set(
        'admin.community.discordRoles.deleted',
      );
    } catch {
      this.statusKey.set(
        'admin.community.discordRoles.deleteFailed',
      );
    } finally {
      this.savingKey.set(null);
    }
  }

  protected async synchronizeAll():
    Promise<void> {
    this.syncing.set(true);
    this.statusKey.set(null);

    try {
      const result = await firstValueFrom(
        this.service.synchronize(),
      );

      this.lastSync.set(result);
      await this.refreshRoleState();

      if (!result) {
        this.statusKey.set(
          'admin.community.discordRoles.syncUnavailable',
        );
      } else if (result.failed > 0) {
        this.statusKey.set(
          'admin.community.discordRoles.syncPartial',
        );
      } else {
        this.statusKey.set(
          'admin.community.discordRoles.syncDone',
        );
      }
    } catch {
      this.statusKey.set(
        'admin.community.discordRoles.syncFailed',
      );
    } finally {
      this.syncing.set(false);
    }
  }

  private async reload(): Promise<void> {
    this.loading.set(true);
    this.statusKey.set(null);

    try {
      const result = await firstValueFrom(
        forkJoin({
          definitions:
            this.service.getDefinitions(),
          catalog:
            this.service.getRoleCatalog(),
          achievements:
            this.service.getAchievements(),
        }),
      );

      this.catalog.set(result.catalog);
      this.achievements.set(
        result.achievements
          .sort(
            (left, right) =>
              left.sortOrder -
                right.sortOrder ||
              left.name.de.localeCompare(
                right.name.de,
              ),
          ),
      );
      this.roles.set(
        result.definitions.map(
          (definition) =>
            this.toDraft(definition),
        ),
      );
    } catch {
      this.statusKey.set(
        'admin.community.discordRoles.loadFailed',
      );
    } finally {
      this.loading.set(false);
    }
  }

  private async refreshRoleState():
    Promise<void> {
    const result = await firstValueFrom(
      forkJoin({
        definitions:
          this.service.getDefinitions(),
        catalog:
          this.service.getRoleCatalog(),
      }),
    );

    this.catalog.set(result.catalog);
    this.roles.set(
      result.definitions.map(
        (definition) =>
          this.toDraft(definition),
      ),
    );
  }

  private async trySynchronize(): Promise<
    DiscordRoleProvisioningResult | null
  > {
    try {
      const result = await firstValueFrom(
        this.service.synchronize(),
      );

      this.lastSync.set(result);
      return result;
    } catch {
      this.lastSync.set(null);
      return null;
    }
  }

  private setSaveStatus(
    result: DiscordRoleProvisioningResult | null,
  ): void {
    if (!result) {
      this.statusKey.set(
        'admin.community.discordRoles.savedSyncUnavailable',
      );
      return;
    }

    this.statusKey.set(
      result.failed > 0
        ? 'admin.community.discordRoles.savedSyncPartial'
        : 'admin.community.discordRoles.savedSynced',
    );
  }

  private roleStatus(
    role: DiscordRoleDraft,
  ): DiscordRoleStatus {
    if (!role.enabled) {
      return 'disabled';
    }

    if (!this.catalog().configured) {
      return 'not-configured';
    }

    if (!this.catalog().connected) {
      return 'disconnected';
    }

    if (
      !role.provisionedByCommunity ||
      !role.discordRoleId
    ) {
      return 'pending';
    }

    const remoteRole =
      this.catalog().roles.find(
        (candidate) =>
          candidate.id === role.discordRoleId,
      );

    if (!remoteRole) {
      return 'missing';
    }

    const remoteColor =
      remoteRole.color?.toLowerCase() ?? null;
    const expectedColor = role.hasColor
      ? role.color.toLowerCase()
      : null;

    if (
      remoteRole.name !== role.name.trim() ||
      remoteColor !== expectedColor
    ) {
      return 'pending';
    }

    return 'synced';
  }

  private roleInput(
    role: DiscordRoleDraft,
  ): SaveCommunityDiscordRoleDefinition {
    return {
      kind: role.kind,
      name: role.name.trim(),
      color: role.hasColor
        ? role.color.toLowerCase()
        : null,
      enabled: role.enabled,
      achievementId:
        role.kind === 'showcase'
          ? role.achievementId
          : null,
      minimumLevel:
        role.kind === 'level-range'
          ? role.minimumLevel
          : null,
      maximumLevel:
        role.kind === 'level-range'
          ? role.maximumLevel
          : null,
      sortOrder: role.sortOrder,
    };
  }

  private toDraft(
    definition: CommunityDiscordRoleDefinition,
  ): DiscordRoleDraft {
    return {
      clientId: definition.id,
      id: definition.id,
      key: definition.key,
      persisted: true,
      kind: definition.kind,
      name: definition.name,
      color: definition.color ?? '#5865f2',
      hasColor: definition.color !== null,
      enabled: definition.enabled,
      discordRoleId:
        definition.discordRoleId,
      provisionedByCommunity:
        definition.provisionedByCommunity,
      achievementId:
        definition.achievementId,
      minimumLevel:
        definition.minimumLevel,
      maximumLevel:
        definition.maximumLevel,
      sortOrder: definition.sortOrder,
    };
  }

  private hasLevelOverlap(
    role: DiscordRoleDraft,
  ): boolean {
    if (
      !role.enabled ||
      role.kind !== 'level-range' ||
      role.minimumLevel === null
    ) {
      return false;
    }

    const maximum =
      role.maximumLevel ??
      Number.POSITIVE_INFINITY;

    return this.roles().some(
      (candidate) => {
        if (
          candidate === role ||
          !candidate.enabled ||
          candidate.kind !== 'level-range' ||
          candidate.minimumLevel === null
        ) {
          return false;
        }

        const candidateMaximum =
          candidate.maximumLevel ??
          Number.POSITIVE_INFINITY;

        return (
          role.minimumLevel! <=
            candidateMaximum &&
          candidate.minimumLevel <= maximum
        );
      },
    );
  }

  private uniqueRoleKey(
    role: DiscordRoleDraft,
  ): string {
    const used = new Set(
      this.roles()
        .filter(
          (candidate) => candidate !== role,
        )
        .map((candidate) => candidate.key),
    );
    const prefix =
      role.kind === 'level-range'
        ? 'level'
        : role.kind;
    const slug =
      this.definitionKey(role.name);
    const base = `${prefix}.${slug}`;

    if (!used.has(base)) {
      return base;
    }

    let suffix = 2;

    while (used.has(`${base}-${suffix}`)) {
      suffix += 1;
    }

    return `${base}-${suffix}`;
  }

  private definitionKey(value: string): string {
    const normalized = value
      .trim()
      .toLowerCase()
      .replaceAll('ä', 'ae')
      .replaceAll('ö', 'oe')
      .replaceAll('ü', 'ue')
      .replaceAll('ß', 'ss')
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 72)
      .replace(/-+$/g, '');

    return normalized || 'role';
  }

  private isPositiveInteger(
    value: number | null,
  ): boolean {
    return (
      value !== null &&
      Number.isSafeInteger(value) &&
      value >= 1
    );
  }
}
