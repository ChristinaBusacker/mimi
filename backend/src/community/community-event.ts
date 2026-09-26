import type {
  CommunityEventSource,
  CommunityEventType,
} from '@shared/community/community-event';

import type { CommunityEventEntry } from './entities/community-event.entry';
import type { XpTransactionEntry } from './entities/xp-transaction.entry';

export interface RecordCommunityEventInput {
  userUuid: string;
  type: CommunityEventType;
  source: CommunityEventSource;
  sourceEventId?: string | null;
  contextId?: string | null;
  occurredAt?: Date;
  contentLength?: number;
  metadata?: Record<string, unknown> | null;
}

export type CommunityEventRecordStatus =
  | 'recorded'
  | 'duplicate'
  | 'rejected';

export type CommunityRewardStatus =
  | 'granted'
  | 'no-rule'
  | 'disabled'
  | 'zero-xp'
  | 'daily-limit'
  | 'context-limit'
  | 'missing-context'
  | 'cooldown'
  | 'not-applicable';

export interface RecordCommunityEventResult {
  status: CommunityEventRecordStatus;
  rewardStatus: CommunityRewardStatus;
  event: CommunityEventEntry | null;
  xpTransaction: XpTransactionEntry | null;
}
