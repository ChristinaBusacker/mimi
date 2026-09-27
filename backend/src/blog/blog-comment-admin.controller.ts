import type {
  BlogAdminComment,
} from '@shared/blog/blog-comment';

import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { AdminGuard } from '../auth/guards/admin.guard';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { AUTH_SESSION_COOKIE } from '../auth/session-cookie';
import type { AuthenticatedRequest } from '../auth/types/authenticated-request';
import { BlogCommentService } from './blog-comment.service';
import {
  BlogAdminCommentDto,
  SetBlogCommentFlagDto,
} from './dto/blog-comment.dto';

@ApiTags('Admin blog comments')
@ApiCookieAuth(AUTH_SESSION_COOKIE)
@UseGuards(
  SessionAuthGuard,
  AdminGuard,
)
@Controller('admin/blog/comments')
export class BlogCommentAdminController {
  constructor(
    private readonly comments:
      BlogCommentService,
  ) {}

  @Get()
  @ApiOperation({
    summary:
      'List blog comments for moderation',
  })
  @ApiOkResponse({
    type: BlogAdminCommentDto,
    isArray: true,
  })
  getComments():
    Promise<BlogAdminComment[]> {
    return this.comments
      .getAdminComments();
  }

  @Put(':id/hidden')
  @ApiOperation({
    summary:
      'Hide or restore a blog comment',
  })
  @ApiOkResponse({
    type: BlogAdminCommentDto,
  })
  setHidden(
    @Param('id')
    id: string,
    @Req()
    request: AuthenticatedRequest,
    @Body()
    dto: SetBlogCommentFlagDto,
  ): Promise<BlogAdminComment> {
    return this.comments.setHidden(
      id,
      dto.value,
      request.user.uuid,
    );
  }

  @Put(':id/featured')
  @ApiOperation({
    summary:
      'Feature or unfeature a blog comment',
  })
  @ApiOkResponse({
    type: BlogAdminCommentDto,
  })
  setFeatured(
    @Param('id')
    id: string,
    @Req()
    request: AuthenticatedRequest,
    @Body()
    dto: SetBlogCommentFlagDto,
  ): Promise<BlogAdminComment> {
    return this.comments.setFeatured(
      id,
      dto.value,
      request.user.uuid,
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary:
      'Delete a blog comment permanently',
  })
  @ApiNoContentResponse()
  async deleteComment(
    @Param('id')
    id: string,
  ): Promise<void> {
    await this.comments.deleteComment(id);
  }
}
