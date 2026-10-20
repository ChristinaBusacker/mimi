import type { MoveAssetsInput } from '@shared/assets/asset';

import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsUUID,
  ValidateIf,
} from 'class-validator';

export class MoveAssetsDto implements MoveAssetsInput {
  @ApiProperty({ type: [String], minItems: 1, maxItems: 1000 })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(1000)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  ids!: string[];

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  @ValidateIf((_, value: unknown) => value !== null)
  @IsUUID('4')
  folderId!: string | null;
}
