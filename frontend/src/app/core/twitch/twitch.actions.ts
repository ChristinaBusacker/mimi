import type { TwitchStatus } from '@shared/twitch/twitch-status';

export class LoadTwitchStatus {
  static readonly type = '[Twitch] Load Status';
}

export class SetTwitchStatus {
  static readonly type = '[Twitch] Set Status';

  constructor(public readonly status: TwitchStatus) {}
}
