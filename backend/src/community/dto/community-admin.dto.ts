import type {
  CommunityEventType,
  SaveCommunityEventRule,
} from '@shared/community/community-event';
import type {
  CommunityAchievementConditionMode,
  CommunityAchievementMetric,
  CommunityAchievementOperator,
  CommunityLocalizedText,
  SaveCommunityAchievementCondition,
  SaveCommunityAchievementDefinition,
  SaveCommunityTitleDefinition,
} from '@shared/community/community-progression';

import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class SaveCommunityEventRuleDto
  implements SaveCommunityEventRule
{
  @IsBoolean()
  enabled!: boolean;

  @IsInt()
  @Min(0)
  xpAmount!: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  dailyRewardLimit!: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  contextRewardLimit!: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  cooldownSeconds!: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  minimumContentLength!: number | null;
}

export class CommunityLocalizedTextDto
  implements CommunityLocalizedText
{
  @IsString()
  @MaxLength(160)
  de!: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  en!: string | null;
}

export class CommunityDescriptionDto
  implements CommunityLocalizedText
{
  @IsString()
  de!: string;

  @IsOptional()
  @IsString()
  en!: string | null;
}

export class SaveCommunityLevelsDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsInt({ each: true })
  @Min(0, { each: true })
  requiredXp!: number[];
}

export class SaveCommunityTitleDto
  implements SaveCommunityTitleDefinition
{
  @IsBoolean()
  enabled!: boolean;

  @ValidateNested()
  @Type(() => CommunityLocalizedTextDto)
  name!: CommunityLocalizedTextDto;

  @ValidateNested()
  @Type(() => CommunityDescriptionDto)
  description!: CommunityDescriptionDto;
}

export class SaveCommunityAchievementConditionDto
  implements SaveCommunityAchievementCondition
{
  @IsString()
  metric!: CommunityAchievementMetric;

  @IsIn(['gte'])
  operator!: CommunityAchievementOperator;

  @IsInt()
  @Min(1)
  threshold!: number;

  @IsOptional()
  @IsString()
  eventType!: CommunityEventType | null;
}

export class SaveCommunityAchievementDto
  implements SaveCommunityAchievementDefinition
{
  @IsBoolean()
  enabled!: boolean;

  @ValidateNested()
  @Type(() => CommunityLocalizedTextDto)
  name!: CommunityLocalizedTextDto;

  @ValidateNested()
  @Type(() => CommunityDescriptionDto)
  description!: CommunityDescriptionDto;

  @IsOptional()
  @IsUUID()
  badgeAssetId!: string | null;

  @IsIn([
    'all',
    'any',
  ])
  conditionMode!:
    CommunityAchievementConditionMode;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({
    each: true,
  })
  @Type(
    () =>
      SaveCommunityAchievementConditionDto,
  )
  conditions!:
    SaveCommunityAchievementConditionDto[];

  @IsInt()
  @Min(0)
  xpReward!: number;

  @IsOptional()
  @IsUUID()
  unlockedTitleId!: string | null;

  @IsOptional()
  @Matches(/^#[0-9a-fA-F]{6}$/)
  unlockedProfileColor!: string | null;

  @IsOptional()
  @Matches(/^\d{1,32}$/)
  discordRoleId!: string | null;

  @IsInt()
  sortOrder!: number;
}
