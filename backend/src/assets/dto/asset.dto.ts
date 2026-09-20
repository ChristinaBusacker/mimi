import type {
  Asset,
  AssetType,
} from '@shared/assets/asset';

import { ApiProperty } from '@nestjs/swagger';

export class AssetDto implements Asset {
  @ApiProperty({
    format: 'uuid',
  })
  id!: string;

  @ApiProperty({
    enum: ['image', 'audio'],
  })
  type!: AssetType;

  @ApiProperty()
  originalFilename!: string;

  @ApiProperty()
  mimeType!: string;

  @ApiProperty()
  sizeBytes!: number;

  @ApiProperty({
    example: '/api/assets/4aa2d987-53a2-4b36-9d38-f5de9e4a2d5f',
  })
  url!: string;

  @ApiProperty({
    format: 'date-time',
  })
  createdAt!: string;
}
