import type {
  CommunityEventType,
  SaveCommunityEventRule,
} from './community-event';

export interface CommunityEventRuleDefault
  extends SaveCommunityEventRule {
  eventType: CommunityEventType;
}

export interface CommunityBalancingDefaults {
  eventRules: CommunityEventRuleDefault[];
  levels: number[];
}
