import type {
  BlogAdminTranslations,
  BlogContributorRole,
  SaveBlogAdminAuthor,
  SaveBlogAdminPost,
} from '@shared/blog/blog-admin';
import type { BlogPublicationStatus } from '@shared/blog/blog';

import { Type } from 'class-transformer';
import {
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

const SLUG_PATTERN =
  /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export class BlogAdminTranslationInputDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  title!: string;

  @IsString()
  @MaxLength(1000)
  excerpt!: string;

  @IsString()
  contentMarkdown!: string;
}

export class BlogAdminTranslationsInputDto
  implements BlogAdminTranslations
{
  @ValidateNested()
  @Type(() => BlogAdminTranslationInputDto)
  de!: BlogAdminTranslationInputDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => BlogAdminTranslationInputDto)
  en!: BlogAdminTranslationInputDto | null;
}

export class SaveBlogAdminPostDto
  implements SaveBlogAdminPost
{
  @IsString()
  @Matches(SLUG_PATTERN)
  slug!: string;

  @IsUUID()
  authorId!: string;

  @IsOptional()
  @IsUUID()
  coverAssetId!: string | null;

  @IsIn([
    'draft',
    'published',
  ])
  status!: BlogPublicationStatus;

  @ValidateNested()
  @Type(() => BlogAdminTranslationsInputDto)
  translations!: BlogAdminTranslationsInputDto;
}

export class SaveBlogAdminAuthorDto
  implements SaveBlogAdminAuthor
{
  @IsString()
  @Matches(SLUG_PATTERN)
  slug!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(255)
  displayName!: string;

  @IsString()
  @MaxLength(3000)
  bio!: string;

  @IsOptional()
  @IsUUID()
  avatarAssetId!: string | null;

  @IsIn([
    'author',
    'editor',
  ])
  role!: BlogContributorRole;
}
