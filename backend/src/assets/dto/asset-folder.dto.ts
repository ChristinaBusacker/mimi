import type { AssetFolder } from '@shared/assets/asset';
import { ApiProperty } from '@nestjs/swagger';

export class AssetFolderDto implements AssetFolder {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ type: String, nullable: true })
  parentId!: string | null;

  @ApiProperty()
  name!: string;
}
