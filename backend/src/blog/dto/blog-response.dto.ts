import type {
  BlogAuthor,
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

  @ApiProperty()
  bio!: string;

  @ApiProperty({
    format: 'uuid',
    nullable: true,
  })
  avatarAssetId!: string | null;
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
}

export class BlogPostDto
  extends BlogPostSummaryDto
  implements BlogPost
{
  @ApiProperty()
  contentHtml!: string;
}
