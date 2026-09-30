import type { UpdateAssetDescriptions } from '@shared/assets/asset';

import {
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateAssetDescriptionsDto
  implements UpdateAssetDescriptions
{
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  @Matches(/\S/)
  descriptionDe!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  @Matches(/\S/)
  descriptionEn!: string;
}
