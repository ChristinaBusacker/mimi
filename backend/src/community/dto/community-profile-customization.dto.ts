import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsOptional,
  IsUUID,
} from 'class-validator';

export class SelectCommunityTitleDto {
  @IsOptional()
  @IsUUID()
  titleId!: string | null;
}

export class SelectCommunityProfileColorDto {
  @IsOptional()
  @IsUUID()
  achievementId!: string | null;
}

export class PinCommunityAchievementsDto {
  @IsArray()
  @ArrayMaxSize(3)
  @ArrayUnique()
  @IsUUID('4', {
    each: true,
  })
  achievementIds!: string[];
}
