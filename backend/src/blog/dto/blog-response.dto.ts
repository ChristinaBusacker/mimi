import type {
  BlogAuthor,
  BlogAuthorPage,
  BlogAuthorProfile,
  BlogCategory,
  BlogPost,
  BlogPostSummary,
} from '@shared/blog/blog';

import { ApiProperty } from '@nestjs/swagger';

export class BlogAuthorDto
  implements BlogAuthor
{
  @ApiProperty()
  slug!: string;

  @ApiProperty()
  displayName!: string;

  @ApiProperty({
    format: 'uuid',
    nullable: true,
  })
  avatarAssetId!: string | null;
}

export class BlogAuthorProfileDto
  extends BlogAuthorDto
  implements BlogAuthorProfile
{
  @ApiProperty()
  bioHtml!: string;
}

export class BlogCategoryDto
  implements BlogCategory
{
  @ApiProperty()
  slug!: string;

  @ApiProperty()
  name!: string;
}

export class BlogPostSummaryDto
  implements BlogPostSummary
{
  @ApiProperty({
    format: 'uuid',
  })
  id!: string;

  @ApiProperty()
  slug!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty()
  excerpt!: string;

  @ApiProperty({
    format: 'uuid',
    nullable: true,
  })
  coverAssetId!: string | null;

  @ApiProperty({
    format: 'date-time',
  })
  publishedAt!: string;

  @ApiProperty({
    type: BlogAuthorDto,
  })
  author!: BlogAuthorDto;

  @ApiProperty({
    type: BlogCategoryDto,
    isArray: true,
  })
  categories!: BlogCategoryDto[];
}

export class BlogPostDto
  extends BlogPostSummaryDto
  implements BlogPost
{
  @ApiProperty({
    type: BlogAuthorProfileDto,
  })
  declare author:
    BlogAuthorProfileDto;

  @ApiProperty()
  contentHtml!: string;
}

export class BlogAuthorPageDto
  implements BlogAuthorPage
{
  @ApiProperty({
    type: BlogAuthorProfileDto,
  })
  author!: BlogAuthorProfileDto;

  @ApiProperty({
    type: BlogPostSummaryDto,
    isArray: true,
  })
  posts!: BlogPostSummaryDto[];
}
