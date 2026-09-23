import type {
  BlogAdminAuthor,
  BlogAdminAuthorCandidate,
  BlogAdminCategory,
  BlogAdminCategoryTranslation,
  BlogAdminCategoryTranslations,
  BlogAdminPost,
  BlogAdminTranslation,
  BlogAdminTranslations,
} from '@shared/blog/blog-admin';
import type { UserRole } from '@shared/auth/authenticated-user';
import type { BlogPublicationStatus } from '@shared/blog/blog';

import { ApiProperty } from '@nestjs/swagger';

export class BlogAdminTranslationDto
  implements BlogAdminTranslation
{
  @ApiProperty()
  title!: string;

  @ApiProperty()
  excerpt!: string;

  @ApiProperty()
  contentMarkdown!: string;
}

export class BlogAdminTranslationsDto
  implements BlogAdminTranslations
{
  @ApiProperty({
    type: BlogAdminTranslationDto,
  })
  de!: BlogAdminTranslationDto;

  @ApiProperty({
    type: BlogAdminTranslationDto,
    nullable: true,
  })
  en!: BlogAdminTranslationDto | null;
}

export class BlogAdminPostDto
  implements BlogAdminPost
{
  @ApiProperty({
    format: 'uuid',
  })
  id!: string;

  @ApiProperty()
  slug!: string;

  @ApiProperty({
    format: 'uuid',
  })
  authorId!: string;

  @ApiProperty({
    type: String,
    isArray: true,
  })
  categoryIds!: string[];

  @ApiProperty({
    format: 'uuid',
    nullable: true,
  })
  coverAssetId!: string | null;

  @ApiProperty({
    enum: [
      'draft',
      'published',
    ],
  })
  status!: BlogPublicationStatus;

  @ApiProperty({
    format: 'date-time',
    nullable: true,
  })
  publishedAt!: string | null;

  @ApiProperty({
    type: BlogAdminTranslationsDto,
  })
  translations!: BlogAdminTranslationsDto;

  @ApiProperty({
    format: 'date-time',
  })
  createdAt!: string;

  @ApiProperty({
    format: 'date-time',
  })
  updatedAt!: string;
}

export class BlogAdminAuthorDto
  implements BlogAdminAuthor
{
  @ApiProperty({
    format: 'uuid',
  })
  userId!: string;

  @ApiProperty()
  slug!: string;

  @ApiProperty()
  displayName!: string;

  @ApiProperty()
  bio!: string;

  @ApiProperty({
    format: 'uuid',
    nullable: true,
  })
  avatarAssetId!: string | null;

  @ApiProperty({
    enum: [
      'user',
      'author',
      'editor',
      'admin',
    ],
  })
  role!: UserRole;

  @ApiProperty({
    format: 'date-time',
  })
  createdAt!: string;

  @ApiProperty({
    format: 'date-time',
  })
  updatedAt!: string;
}

export class BlogAdminAuthorCandidateDto
  implements BlogAdminAuthorCandidate
{
  @ApiProperty({
    format: 'uuid',
  })
  userId!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({
    format: 'email',
  })
  email!: string;

  @ApiProperty({
    enum: [
      'user',
      'author',
      'editor',
      'admin',
    ],
  })
  role!: UserRole;

  @ApiProperty({
    type: BlogAdminAuthorDto,
    nullable: true,
  })
  profile!: BlogAdminAuthorDto | null;
}

export class BlogAdminCategoryTranslationDto
  implements BlogAdminCategoryTranslation
{
  @ApiProperty()
  name!: string;
}

export class BlogAdminCategoryTranslationsDto
  implements BlogAdminCategoryTranslations
{
  @ApiProperty({
    type:
      BlogAdminCategoryTranslationDto,
  })
  de!: BlogAdminCategoryTranslationDto;

  @ApiProperty({
    type:
      BlogAdminCategoryTranslationDto,
    nullable: true,
  })
  en!:
    BlogAdminCategoryTranslationDto | null;
}

export class BlogAdminCategoryDto
  implements BlogAdminCategory
{
  @ApiProperty({
    format: 'uuid',
  })
  id!: string;

  @ApiProperty()
  slug!: string;

  @ApiProperty({
    type:
      BlogAdminCategoryTranslationsDto,
  })
  translations!:
    BlogAdminCategoryTranslationsDto;
}
