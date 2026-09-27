import type {
  CommunityEventType,
} from '@shared/community/community-event';

import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Interval } from '@nestjs/schedule';
import {
  createHmac,
  timingSafeEqual,
} from 'node:crypto';

import { TwitchService } from '../../integrations/twitch/twitch.service';
import { CommunityEventService } from '../community-event.service';
import { CommunityTwitchIdentityService } from './community-twitch-identity.service';

const EVENTSUB_RECONCILIATION_INTERVAL_MS =
  6 * 60 * 60 * 1000;
const EVENTSUB_BOOTSTRAP_DELAY_MS =
  15 * 1000;
const EVENTSUB_MESSAGE_MAX_AGE_MS =
  10 * 60 * 1000;
const SETUP_STATE_TTL_MS =
  10 * 60 * 1000;

const EVENTSUB_SCOPES = [
  'channel:read:subscriptions',
  'user:read:chat',
  'user:bot',
  'channel:bot',
] as const;

interface TwitchOAuthTokenResponse {
  access_token: string;
  scope: string[];
}

interface TwitchUserResponse {
  data: Array<{
    id: string;
    login: string;
    display_name: string;
  }>;
}

interface EventSubSubscription {
  id?: string;
  type: string;
  status?: string;
  condition?: Record<string, string>;
}

export interface TwitchEventSubWebhookBody {
  challenge?: string;
  subscription?: EventSubSubscription;
  event?: Record<string, unknown>;
}

export interface TwitchEventSubWebhookInput {
  messageId: string | undefined;
  messageTimestamp: string | undefined;
  messageSignature: string | undefined;
  messageType: string | undefined;
  rawBody: Buffer;
  body: TwitchEventSubWebhookBody;
}

export interface TwitchEventSubWebhookResult {
  challenge: string | null;
}

interface SetupStatePayload {
  userUuid: string;
  expiresAt: number;
}

interface EventSubDefinition {
  type: string;
  version: string;
  condition: Record<string, string>;
}

@Injectable()
export class CommunityTwitchEventSubService
  implements OnApplicationBootstrap
{
  private readonly logger =
    new Logger(
      CommunityTwitchEventSubService.name,
    );
  private readonly clientId: string | null;
  private readonly clientSecret:
    string | null;
  private readonly channelLogin:
    string | null;
  private readonly eventSubSecret:
    string | null;
  private readonly publicSiteUrl:
    string | null;
  private readonly eventSubCallbackUrl:
    string | null;

  constructor(
    config: ConfigService,
    private readonly twitch: TwitchService,
    private readonly identities:
      CommunityTwitchIdentityService,
    private readonly events:
      CommunityEventService,
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
    this.channelLogin =
      this.normalizeConfigValue(
        config.get<string>(
          'TWITCH_CHANNEL_LOGIN',
        ),
      );
    this.eventSubSecret =
      this.normalizeConfigValue(
        config.get<string>(
          'TWITCH_EVENTSUB_SECRET',
        ),
      );
    this.publicSiteUrl =
      this.normalizeConfigValue(
        config.get<string>(
          'PUBLIC_SITE_URL',
        ),
      );
    this.eventSubCallbackUrl =
      this.normalizeConfigValue(
        config.get<string>(
          'TWITCH_EVENTSUB_CALLBACK_URL',
        ),
      );
  }

  onApplicationBootstrap(): void {
    if (!this.isConfigured()) {
      this.logger.log(
        'Twitch EventSub community integration is disabled.',
      );
      return;
    }

    const timer = setTimeout(() => {
      void this.reconcileSubscriptions();
    }, EVENTSUB_BOOTSTRAP_DELAY_MS);

    timer.unref();
  }

  createBroadcasterAuthorizationUrl(
    adminUserUuid: string,
  ): string {
    this.assertConfigured();

    const url = new URL(
      'https://id.twitch.tv/oauth2/authorize',
    );

    url.searchParams.set(
      'client_id',
      this.clientId!,
    );
    url.searchParams.set(
      'redirect_uri',
      this.getSetupRedirectUri(),
    );
    url.searchParams.set(
      'response_type',
      'code',
    );
    url.searchParams.set(
      'scope',
      EVENTSUB_SCOPES.join(' '),
    );
    url.searchParams.set(
      'force_verify',
      'true',
    );
    url.searchParams.set(
      'state',
      this.createSetupState(
        adminUserUuid,
      ),
    );

    return url.toString();
  }

  async completeBroadcasterAuthorization(
    adminUserUuid: string,
    code: string | undefined,
    state: string | undefined,
  ): Promise<void> {
    this.assertConfigured();

    const normalizedCode = code?.trim();
    const normalizedState = state?.trim();

    if (
      !normalizedCode ||
      !normalizedState
    ) {
      throw new BadRequestException(
        'Twitch EventSub setup callback is missing code or state.',
      );
    }

    const statePayload =
      this.verifySetupState(
        normalizedState,
      );

    if (
      statePayload.userUuid !==
      adminUserUuid
    ) {
      throw new UnauthorizedException(
        'Twitch EventSub setup state does not belong to the current admin session.',
      );
    }

    const token =
      await this.exchangeSetupCode(
        normalizedCode,
      );
    const missingScopes =
      EVENTSUB_SCOPES.filter(
        (scope) =>
          !token.scope.includes(scope),
      );

    if (missingScopes.length > 0) {
      throw new BadRequestException(
        `Twitch did not grant the required EventSub scopes: ${missingScopes.join(', ')}.`,
      );
    }

    const user =
      await this.loadCurrentUser(
        token.access_token,
      );

    if (
      user.login.toLowerCase() !==
      this.channelLogin!.toLowerCase()
    ) {
      throw new BadRequestException(
        `Twitch EventSub must be authorized by the configured broadcaster "${this.channelLogin}".`,
      );
    }

    if (this.hasPublicWebhookCallback()) {
      await this.ensureSubscriptions();
    } else {
      this.logger.log(
        'Twitch EventSub broadcaster authorization completed. Subscription registration is deferred until a public HTTPS callback URL is configured.',
      );
    }
  }

  async handleWebhook(
    input: TwitchEventSubWebhookInput,
  ): Promise<TwitchEventSubWebhookResult> {
    this.assertConfigured();
    this.verifyWebhook(input);

    switch (input.messageType) {
      case 'webhook_callback_verification': {
        const challenge =
          input.body.challenge?.trim();

        if (!challenge) {
          throw new BadRequestException(
            'Twitch EventSub verification did not include a challenge.',
          );
        }

        return {
          challenge,
        };
      }

      case 'notification':
        await this.processNotification(
          input.messageId!,
          input.messageTimestamp!,
          input.body,
        );
        break;

      case 'revocation':
        this.logger.warn(
          `Twitch EventSub subscription was revoked: ${input.body.subscription?.type ?? 'unknown'} (${input.body.subscription?.status ?? 'unknown status'}).`,
        );
        break;

      default:
        this.logger.warn(
          `Ignoring unknown Twitch EventSub message type "${input.messageType}".`,
        );
    }

    return {
      challenge: null,
    };
  }

  @Interval(
    'twitch-community-eventsub-reconciliation',
    EVENTSUB_RECONCILIATION_INTERVAL_MS,
  )
  async reconcileSubscriptions():
    Promise<void> {
    if (
      !this.isConfigured() ||
      !this.hasPublicWebhookCallback()
    ) {
      return;
    }

    try {
      await this.ensureSubscriptions();
    } catch (error: unknown) {
      this.logger.warn(
        `Could not reconcile Twitch EventSub subscriptions: ${this.errorMessage(error)}`,
      );
    }
  }

  private async ensureSubscriptions():
    Promise<void> {
    const callback =
      this.getWebhookCallbackUrl();

    if (!this.isPublicHttpsUrl(callback)) {
      throw new ServiceUnavailableException(
        'Twitch EventSub needs a public HTTPS callback URL on port 443.',
      );
    }

    const [
      broadcasterId,
      appAccessToken,
    ] = await Promise.all([
      this.twitch.getBroadcasterId(),
      this.twitch.getAppAccessToken(),
    ]);
    const definitions:
      EventSubDefinition[] = [
        {
          type: 'channel.subscribe',
          version: '1',
          condition: {
            broadcaster_user_id:
              broadcasterId,
          },
        },
        {
          type:
            'channel.subscription.message',
          version: '1',
          condition: {
            broadcaster_user_id:
              broadcasterId,
          },
        },
        {
          type:
            'channel.subscription.end',
          version: '1',
          condition: {
            broadcaster_user_id:
              broadcasterId,
          },
        },
        {
          type: 'channel.chat.message',
          version: '1',
          condition: {
            broadcaster_user_id:
              broadcasterId,
            user_id: broadcasterId,
          },
        },
      ];
    const failed: string[] = [];

    for (const definition of definitions) {
      const response = await fetch(
        'https://api.twitch.tv/helix/eventsub/subscriptions',
        {
          method: 'POST',
          headers: {
            Authorization:
              `Bearer ${appAccessToken}`,
            'Client-Id': this.clientId!,
            'Content-Type':
              'application/json',
          },
          body: JSON.stringify({
            ...definition,
            transport: {
              method: 'webhook',
              callback,
              secret:
                this.eventSubSecret!,
            },
          }),
        },
      );

      if (
        response.status === 202 ||
        response.status === 409
      ) {
        continue;
      }

      failed.push(
        `${definition.type}: ${response.status} ${await this.responseText(response)}`,
      );
    }

    if (failed.length > 0) {
      throw new BadGatewayException(
        `Twitch rejected EventSub subscriptions: ${failed.join(' | ')}`,
      );
    }
  }

  private async processNotification(
    messageId: string,
    messageTimestamp: string,
    body: TwitchEventSubWebhookBody,
  ): Promise<void> {
    const type = body.subscription?.type;
    const event = body.event;

    if (!type || !event) {
      throw new BadRequestException(
        'Twitch EventSub notification is missing subscription or event data.',
      );
    }

    const occurredAt =
      new Date(messageTimestamp);

    switch (type) {
      case 'channel.chat.message': {
        const twitchUserId =
          this.stringValue(
            event,
            'chatter_user_id',
          );
        const message =
          this.recordValue(
            event,
            'message',
          );
        const text = message
          ? this.stringValue(
              message,
              'text',
            ) ?? ''
          : '';

        if (!twitchUserId) {
          return;
        }

        await this.recordLinkedEvent({
          twitchUserId,
          type: 'twitch.chat.activity',
          messageId,
          occurredAt,
          contentLength:
            Array.from(
              text.trim(),
            ).length,
        });
        break;
      }

      case 'channel.subscribe': {
        const twitchUserId =
          this.stringValue(
            event,
            'user_id',
          );

        if (!twitchUserId) {
          return;
        }

        await this.recordLinkedEvent({
          twitchUserId,
          type:
            'twitch.subscription.started',
          messageId,
          occurredAt,
          metadata: {
            tier:
              this.stringValue(
                event,
                'tier',
              ),
            isGift:
              this.booleanValue(
                event,
                'is_gift',
              ),
          },
        });
        break;
      }

      case 'channel.subscription.message': {
        const twitchUserId =
          this.stringValue(
            event,
            'user_id',
          );

        if (!twitchUserId) {
          return;
        }

        await this.recordLinkedEvent({
          twitchUserId,
          type:
            'twitch.subscription.resub',
          messageId,
          occurredAt,
          metadata: {
            tier:
              this.stringValue(
                event,
                'tier',
              ),
            cumulativeMonths:
              this.numberValue(
                event,
                'cumulative_months',
              ),
            streakMonths:
              this.numberValue(
                event,
                'streak_months',
              ),
            durationMonths:
              this.numberValue(
                event,
                'duration_months',
              ),
          },
        });
        break;
      }

      case 'channel.subscription.end': {
        const twitchUserId =
          this.stringValue(
            event,
            'user_id',
          );

        if (!twitchUserId) {
          return;
        }

        await this.recordLinkedEvent({
          twitchUserId,
          type:
            'twitch.subscription.ended',
          messageId,
          occurredAt,
          metadata: {
            tier:
              this.stringValue(
                event,
                'tier',
              ),
            isGift:
              this.booleanValue(
                event,
                'is_gift',
              ),
          },
        });
        break;
      }
    }
  }

  private async recordLinkedEvent(
    input: {
      twitchUserId: string;
      type: CommunityEventType;
      messageId: string;
      occurredAt: Date;
      contentLength?: number;
      metadata?: Record<
        string,
        string | number | boolean | null
      >;
    },
  ): Promise<void> {
    const userUuid =
      await this.identities
        .findUserUuidByTwitchUserId(
          input.twitchUserId,
        );

    if (!userUuid) {
      return;
    }

    await this.events.recordEvent({
      userUuid,
      type: input.type,
      source: 'twitch',
      sourceEventId:
        input.messageId,
      occurredAt:
        input.occurredAt,
      ...(input.contentLength ===
      undefined
        ? {}
        : {
            contentLength:
              input.contentLength,
          }),
      ...(input.metadata
        ? {
            metadata:
              input.metadata,
          }
        : {}),
    });
  }

  private verifyWebhook(
    input: TwitchEventSubWebhookInput,
  ): void {
    const messageId =
      input.messageId?.trim();
    const timestamp =
      input.messageTimestamp?.trim();
    const signature =
      input.messageSignature?.trim();
    const messageType =
      input.messageType?.trim();

    if (
      !messageId ||
      !timestamp ||
      !signature ||
      !messageType
    ) {
      throw new UnauthorizedException(
        'Twitch EventSub signature headers are incomplete.',
      );
    }

    const messageTime =
      Date.parse(timestamp);

    if (
      !Number.isFinite(messageTime) ||
      Math.abs(
        Date.now() - messageTime,
      ) > EVENTSUB_MESSAGE_MAX_AGE_MS
    ) {
      throw new UnauthorizedException(
        'Twitch EventSub message timestamp is invalid or too old.',
      );
    }

    const expected =
      `sha256=${createHmac(
        'sha256',
        this.eventSubSecret!,
      )
        .update(messageId)
        .update(timestamp)
        .update(input.rawBody)
        .digest('hex')}`;

    if (
      !this.safeEqual(
        signature,
        expected,
      )
    ) {
      throw new UnauthorizedException(
        'Twitch EventSub signature is invalid.',
      );
    }
  }

  private createSetupState(
    userUuid: string,
  ): string {
    const payload: SetupStatePayload = {
      userUuid,
      expiresAt:
        Date.now() + SETUP_STATE_TTL_MS,
    };
    const encoded = Buffer.from(
      JSON.stringify(payload),
      'utf8',
    ).toString('base64url');
    const signature =
      createHmac(
        'sha256',
        this.eventSubSecret!,
      )
        .update(encoded)
        .digest('base64url');

    return `${encoded}.${signature}`;
  }

  private verifySetupState(
    state: string,
  ): SetupStatePayload {
    const [encoded, signature, extra] =
      state.split('.');

    if (
      !encoded ||
      !signature ||
      extra !== undefined
    ) {
      throw new UnauthorizedException(
        'Twitch EventSub setup state is invalid.',
      );
    }

    const expected =
      createHmac(
        'sha256',
        this.eventSubSecret!,
      )
        .update(encoded)
        .digest('base64url');

    if (!this.safeEqual(signature, expected)) {
      throw new UnauthorizedException(
        'Twitch EventSub setup state signature is invalid.',
      );
    }

    let payload: SetupStatePayload;

    try {
      payload = JSON.parse(
        Buffer.from(
          encoded,
          'base64url',
        ).toString('utf8'),
      ) as SetupStatePayload;
    } catch {
      throw new UnauthorizedException(
        'Twitch EventSub setup state payload is invalid.',
      );
    }

    if (
      typeof payload.userUuid !==
        'string' ||
      !Number.isFinite(
        payload.expiresAt,
      ) ||
      payload.expiresAt <= Date.now()
    ) {
      throw new UnauthorizedException(
        'Twitch EventSub setup state is expired or invalid.',
      );
    }

    return payload;
  }

  private async exchangeSetupCode(
    code: string,
  ): Promise<TwitchOAuthTokenResponse> {
    const body = new URLSearchParams({
      client_id: this.clientId!,
      client_secret:
        this.clientSecret!,
      code,
      grant_type:
        'authorization_code',
      redirect_uri:
        this.getSetupRedirectUri(),
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
        `Twitch EventSub authorization exchange failed (${response.status}).`,
      );
    }

    const result =
      (await response.json()) as
        TwitchOAuthTokenResponse;

    if (
      !result.access_token ||
      !Array.isArray(result.scope)
    ) {
      throw new BadGatewayException(
        'Twitch EventSub authorization did not return the expected token data.',
      );
    }

    return result;
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
        `Could not load Twitch EventSub broadcaster (${response.status}).`,
      );
    }

    const result =
      (await response.json()) as
        TwitchUserResponse;
    const user = result.data[0];

    if (!user) {
      throw new BadGatewayException(
        'Twitch did not return the EventSub broadcaster.',
      );
    }

    return user;
  }

  private getSetupRedirectUri(): string {
    return new URL(
      '/api/community/twitch/eventsub/setup/callback',
      this.publicSiteUrl!,
    ).toString();
  }

  private getWebhookCallbackUrl(): string {
    if (this.eventSubCallbackUrl) {
      return this.eventSubCallbackUrl;
    }

    return new URL(
      '/api/community/twitch/eventsub',
      this.publicSiteUrl!,
    ).toString();
  }

  private hasPublicWebhookCallback(): boolean {
    if (!this.isConfigured()) {
      return false;
    }

    return this.isPublicHttpsUrl(
      this.getWebhookCallbackUrl(),
    );
  }

  private isPublicHttpsUrl(
    value: string,
  ): boolean {
    try {
      const url = new URL(value);

      return (
        url.protocol === 'https:' &&
        (url.port === '' ||
          url.port === '443') &&
        url.hostname !== 'localhost' &&
        url.hostname !== '127.0.0.1'
      );
    } catch {
      return false;
    }
  }

  private isConfigured(): boolean {
    return Boolean(
      this.clientId &&
        this.clientSecret &&
        this.channelLogin &&
        this.eventSubSecret &&
        this.eventSubSecret.length >= 10 &&
        this.eventSubSecret.length <= 100 &&
        this.publicSiteUrl,
    );
  }

  private assertConfigured(): void {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException(
        'Twitch EventSub is not configured. TWITCH_EVENTSUB_SECRET must be 10 to 100 characters long.',
      );
    }
  }

  private safeEqual(
    left: string,
    right: string,
  ): boolean {
    const leftBuffer = Buffer.from(left);
    const rightBuffer = Buffer.from(right);

    return (
      leftBuffer.length ===
        rightBuffer.length &&
      timingSafeEqual(
        leftBuffer,
        rightBuffer,
      )
    );
  }

  private stringValue(
    source: Record<string, unknown>,
    key: string,
  ): string | null {
    const value = source[key];

    return typeof value === 'string'
      ? value
      : null;
  }

  private numberValue(
    source: Record<string, unknown>,
    key: string,
  ): number | null {
    const value = source[key];

    return typeof value === 'number' &&
      Number.isFinite(value)
      ? value
      : null;
  }

  private booleanValue(
    source: Record<string, unknown>,
    key: string,
  ): boolean | null {
    const value = source[key];

    return typeof value === 'boolean'
      ? value
      : null;
  }

  private recordValue(
    source: Record<string, unknown>,
    key: string,
  ): Record<string, unknown> | null {
    const value = source[key];

    return typeof value === 'object' &&
      value !== null &&
      !Array.isArray(value)
      ? (value as Record<
          string,
          unknown
        >)
      : null;
  }

  private async responseText(
    response: Response,
  ): Promise<string> {
    const text =
      (await response.text()).trim();

    return text.length > 300
      ? `${text.slice(0, 300)}…`
      : text;
  }

  private normalizeConfigValue(
    value: string | undefined,
  ): string | null {
    return value?.trim() || null;
  }

  private errorMessage(
    error: unknown,
  ): string {
    return error instanceof Error
      ? error.message
      : String(error);
  }
}
