import type {
  SaveManagedUser,
  SaveOwnProfile,
} from '@shared/users/user';

import {
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

const SLUG_PATTERN =
  /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export class SaveManagedUserDto
  implements SaveManagedUser
{
  @IsIn([
    'user',
    'author',
    'editor',
    'admin',
  ])
  role!: SaveManagedUser['role'];

  @IsOptional()
  @IsString()
  @Matches(SLUG_PATTERN)
  slug!: string | null;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  displayName!: string | null;
}

export class SaveOwnProfileDto
  implements SaveOwnProfile
{
  @IsString()
  @MaxLength(6000)
  bio!: string;

  @IsOptional()
  @IsUUID()
  avatarAssetId!: string | null;
}
