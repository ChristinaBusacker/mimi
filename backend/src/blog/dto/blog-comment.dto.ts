import type {
  BlogComment,
  BlogCommentAuthor,
  CreateBlogComment,
} from '@shared/blog/blog-comment';

import {
  ApiProperty,
} from '@nestjs/swagger';
import {
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateBlogCommentDto
  implements CreateBlogComment
{
  @ApiProperty({
    minLength: 1,
    maxLength: 2000,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  content!: string;
}

export class BlogCommentAuthorDto
  implements BlogCommentAuthor
{
  @ApiProperty()
  displayName!: string;

  @ApiProperty({
    nullable: true,
  })
  profileColor!: string | null;
}

export class BlogCommentDto
  implements BlogComment
{
  @ApiProperty({
    format: 'uuid',
  })
  id!: string;

  @ApiProperty({
    format: 'uuid',
  })
  postId!: string;

  @ApiProperty()
  content!: string;

  @ApiProperty({
    type: BlogCommentAuthorDto,
  })
  author!: BlogCommentAuthorDto;

  @ApiProperty({
    format: 'date-time',
  })
  createdAt!: string;

  @ApiProperty({
    format: 'date-time',
  })
  updatedAt!: string;
}
