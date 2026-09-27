import type {
  BlogComment,
} from '@shared/blog/blog-comment';

import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { AUTH_SESSION_COOKIE } from '../auth/session-cookie';
import type { AuthenticatedRequest } from '../auth/types/authenticated-request';
import { BlogCommentService } from './blog-comment.service';
import {
  BlogCommentDto,
  CreateBlogCommentDto,
} from './dto/blog-comment.dto';

@ApiTags('Blog comments')
@Controller('blog/posts/:slug/comments')
export class BlogCommentController {
  constructor(
    private readonly comments:
      BlogCommentService,
  ) {}

  @Get()
  @ApiOperation({
    summary:
      'List comments for a published blog post',
  })
  @ApiOkResponse({
    type: BlogCommentDto,
    isArray: true,
  })
  getComments(
    @Param('slug')
    slug: string,
  ): Promise<BlogComment[]> {
    return this.comments.getComments(slug);
  }

  @Post()
  @UseGuards(SessionAuthGuard)
  @ApiCookieAuth(AUTH_SESSION_COOKIE)
  @ApiOperation({
    summary:
      'Create a comment as the current community member',
  })
  @ApiCreatedResponse({
    type: BlogCommentDto,
  })
  createComment(
    @Param('slug')
    slug: string,
    @Req()
    request: AuthenticatedRequest,
    @Body()
    dto: CreateBlogCommentDto,
  ): Promise<BlogComment> {
    return this.comments.createComment(
      slug,
      request.user.uuid,
      dto.content,
    );
  }
}
