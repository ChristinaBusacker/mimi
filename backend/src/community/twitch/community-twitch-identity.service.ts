import type {
  CommunityDashboardTwitchConnection,
} from '@shared/community/community-dashboard';

import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import {
  createHash,
  randomBytes,
} from 'node:crypto';
import {
  LessThanOrEqual,
  Repository,
} from 'typeorm';

import { CommunityTwitchIdentityEntry } from './community-twitch-identity.entry';
import { CommunityTwitchLinkStateEntry } from './community-twitch-link-state.entry';

const LINK_STATE_TTL_MS =
  10 * 60 * 1000;

interface TwitchTokenResponse {
  access_token: string;
}

interface TwitchUserResponse {
  data: Array<{
    id: string;
    login: string;
    display_name: string;
    profile_image_url: string;
  }>;
}

@Injectable()
export class CommunityTwitchIdentityService {
  private readonly clientId: string | null;
  private readonly clientSecret: string | null;
  private readonly publicSiteUrl: string | null;

  constructor(
    config: ConfigService,
    @InjectRepository(
      CommunityTwitchIdentityEntry,
    )
    private readonly identities:
      Repository<CommunityTwitchIdentityEntry>,
    @InjectRepository(
      CommunityTwitchLinkStateEntry,
    )
    private readonly linkStates:
      Repository<CommunityTwitchLinkStateEntry>,
  ) {
    this.clientId =
      this.normalizeConfigValue(
        config.get<string>(
          'TWITCH_CLIENT_ID',
        ),
      );
    this.clientSecret =
      this.normalizeConfigValue(
        config.get<string>(
          'TWITCH_CLIENT_SECRET',
        ),
      );
    this.publicSiteUrl =
      this.normalizeConfigValue(
        config.get<string>(
          'PUBLIC_SITE_URL',
        ),
      );
  }

  async getConnection(
    userUuid: string,
  ): Promise<CommunityDashboardTwitchConnection> {
    const identity =
      await this.identities.findOneBy({
        userUuid,
      });

    if (!identity) {
      return {
        configured: this.isConfigured(),
        connected: false,
        login: null,
        displayName: null,
        profileImageUrl: null,
        linkedAt: null,
      };
    }

    return {
      configured: this.isConfigured(),
      connected: true,
      login: identity.login,
      displayName: identity.displayName,
      profileImageUrl:
        identity.profileImageUrl,
      linkedAt:
        identity.linkedAt.toISOString(),
    };
  }

  async findUserUuidByTwitchUserId(
    twitchUserId: string,
  ): Promise<string | null> {
    const identity =
      await this.identities.findOneBy({
        twitchUserId:
          twitchUserId.trim(),
      });

    return identity?.userUuid ?? null;
  }

  async createAuthorizationUrl(
    userUuid: string,
  ): Promise<string> {
    this.assertConfigured();

    const now = new Date();
    const state =
      randomBytes(32).toString(
        'base64url',
      );

    await Promise.all([
      this.linkStates.delete({
        userUuid,
      }),
      this.linkStates.delete({
        expiresAt:
          LessThanOrEqual(now),
      }),
    ]);

    await this.linkStates.save(
      this.linkStates.create({
        stateHash:
          this.hashState(state),
        userUuid,
        expiresAt: new Date(
          now.getTime() +
            LINK_STATE_TTL_MS,
        ),
      }),
    );

    const url = new URL(
      'https://id.twitch.tv/oauth2/authorize',
    );

    url.searchParams.set(
      'client_id',
      this.clientId!,
    );
    url.searchParams.set(
      'redirect_uri',
      this.getRedirectUri(),
    );
    url.searchParams.set(
      'response_type',
      'code',
    );
    url.searchParams.set(
      'scope',
      'openid',
    );
    url.searchParams.set(
      'state',
      state,
    );

    return url.toString();
  }

  async completeLink(
    code: string | undefined,
    state: string | undefined,
  ): Promise<string> {
    this.assertConfigured();

    const normalizedCode =
      code?.trim();
    const normalizedState =
      state?.trim();

    if (
      !normalizedCode ||
      !normalizedState
    ) {
      throw new BadRequestException(
        'Twitch callback is missing code or state.',
      );
    }

    const stateHash =
      this.hashState(normalizedState);
    const linkState =
      await this.linkStates.findOneBy({
        stateHash,
      });

    if (
      !linkState ||
      linkState.expiresAt.getTime() <=
        Date.now()
    ) {
      if (linkState) {
        await this.linkStates.delete({
          stateHash,
        });
      }

      throw new BadRequestException(
        'Twitch link state is invalid or expired.',
      );
    }

    const accessToken =
      await this.exchangeCode(
        normalizedCode,
      );
    const twitchUser =
      await this.loadCurrentUser(
        accessToken,
      );
    const existing =
      await this.identities.findOneBy({
        twitchUserId: twitchUser.id,
      });

    if (
      existing &&
      existing.userUuid !==
        linkState.userUuid
    ) {
      await this.linkStates.delete({
        stateHash,
      });

      throw new ConflictException(
        'This Twitch account is already connected to another community account.',
      );
    }

    await this.identities.save(
      this.identities.create({
        userUuid: linkState.userUuid,
        twitchUserId: twitchUser.id,
        login: twitchUser.login,
        displayName:
          twitchUser.display_name,
        profileImageUrl:
          twitchUser.profile_image_url ||
          null,
      }),
    );

    await this.linkStates.delete({
      stateHash,
    });

    return linkState.userUuid;
  }

  async disconnect(
    userUuid: string,
  ): Promise<void> {
    await Promise.all([
      this.identities.delete({
        userUuid,
      }),
      this.linkStates.delete({
        userUuid,
      }),
    ]);
  }

  private isConfigured(): boolean {
    return Boolean(
      this.clientId &&
        this.clientSecret &&
        this.publicSiteUrl,
    );
  }

  private assertConfigured(): void {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException(
        'Twitch account linking is not configured.',
      );
    }
  }

  private getRedirectUri(): string {
    return new URL(
      '/api/community/twitch/callback',
      this.publicSiteUrl!,
    ).toString();
  }

  private async exchangeCode(
    code: string,
  ): Promise<string> {
    const body = new URLSearchParams({
      client_id: this.clientId!,
      client_secret:
        this.clientSecret!,
      code,
      grant_type:
        'authorization_code',
      redirect_uri:
        this.getRedirectUri(),
    });
    const response = await fetch(
      'https://id.twitch.tv/oauth2/token',
      {
        method: 'POST',
        headers: {
          'Content-Type':
            'application/x-www-form-urlencoded',
        },
        body,
      },
    );

    if (!response.ok) {
      throw new BadGatewayException(
        `Twitch token exchange failed (${response.status}).`,
      );
    }

    const result =
      (await response.json()) as
        TwitchTokenResponse;

    if (!result.access_token) {
      throw new BadGatewayException(
        'Twitch token exchange did not return an access token.',
      );
    }

    return result.access_token;
  }

  private async loadCurrentUser(
    accessToken: string,
  ): Promise<TwitchUserResponse['data'][number]> {
    const response = await fetch(
      'https://api.twitch.tv/helix/users',
      {
        headers: {
          Authorization:
            `Bearer ${accessToken}`,
          'Client-Id': this.clientId!,
        },
      },
    );

    if (!response.ok) {
      throw new BadGatewayException(
        `Could not load Twitch user (${response.status}).`,
      );
    }

    const result =
      (await response.json()) as
        TwitchUserResponse;
    const user = result.data[0];

    if (!user) {
      throw new BadGatewayException(
        'Twitch did not return the authenticated user.',
      );
    }

    return user;
  }

  private hashState(
    state: string,
  ): string {
    return createHash('sha256')
      .update(state)
      .digest('hex');
  }

  private normalizeConfigValue(
    value: string | undefined,
  ): string | null {
    return value?.trim() || null;
  }
}
