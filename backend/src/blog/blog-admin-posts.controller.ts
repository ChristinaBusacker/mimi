import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { AUTH_SESSION_COOKIE } from '../auth/session-cookie';
import type { AuthenticatedRequest } from '../auth/types/authenticated-request';
import { BlogAdminService } from './blog-admin.service';
import { BlogAdminPostDto } from './dto/blog-admin-response.dto';
import { SaveBlogAdminPostDto } from './dto/save-blog.dto';
import { BlogContributorGuard } from './guards/blog-contributor.guard';

@ApiTags('Admin Blog Posts')
@ApiCookieAuth(AUTH_SESSION_COOKIE)
@UseGuards(
  SessionAuthGuard,
  BlogContributorGuard,
)
@Controller('admin/blog/posts')
export class BlogAdminPostsController {
  constructor(
    private readonly blogAdminService:
      BlogAdminService,
  ) {}

  @Get()
  @ApiOperation({
    summary:
      'List blog posts available to the current contributor',
  })
  @ApiOkResponse({
    type: BlogAdminPostDto,
    isArray: true,
  })
  getPosts(
    @Req()
    request: AuthenticatedRequest,
  ): Promise<BlogAdminPostDto[]> {
    return this.blogAdminService.getPosts(
      request.user,
    );
  }

  @Get(':uuid')
  @ApiOperation({
    summary:
      'Get one blog post for editing',
  })
  @ApiOkResponse({
    type: BlogAdminPostDto,
  })
  @ApiNotFoundResponse({
    description:
      'The blog post does not exist.',
  })
  @ApiForbiddenResponse({
    description:
      'The current contributor may not edit this post.',
  })
  getPost(
    @Param('uuid')
    uuid: string,
    @Req()
    request: AuthenticatedRequest,
  ): Promise<BlogAdminPostDto> {
    return this.blogAdminService.getPost(
      uuid,
      request.user,
    );
  }

  @Post()
  @ApiOperation({
    summary:
      'Create a blog post',
  })
  @ApiCreatedResponse({
    type: BlogAdminPostDto,
  })
  @ApiConflictResponse({
    description:
      'The blog post slug already exists.',
  })
  @ApiForbiddenResponse({
    description:
      'The current contributor may not publish or assign this post.',
  })
  createPost(
    @Body()
    dto: SaveBlogAdminPostDto,
    @Req()
    request: AuthenticatedRequest,
  ): Promise<BlogAdminPostDto> {
    return this.blogAdminService.createPost(
      dto,
      request.user,
    );
  }

  @Patch(':uuid')
  @ApiOperation({
    summary:
      'Update a blog post',
  })
  @ApiOkResponse({
    type: BlogAdminPostDto,
  })
  @ApiNotFoundResponse({
    description:
      'The blog post does not exist.',
  })
  @ApiConflictResponse({
    description:
      'The blog post slug already exists.',
  })
  @ApiForbiddenResponse({
    description:
      'The current contributor may not edit, publish or assign this post.',
  })
  updatePost(
    @Param('uuid')
    uuid: string,
    @Body()
    dto: SaveBlogAdminPostDto,
    @Req()
    request: AuthenticatedRequest,
  ): Promise<BlogAdminPostDto> {
    return this.blogAdminService.updatePost(
      uuid,
      dto,
      request.user,
    );
  }

  @Delete(':uuid')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary:
      'Delete a blog post',
  })
  @ApiNoContentResponse({
    description:
      'The blog post was deleted.',
  })
  @ApiForbiddenResponse({
    description:
      'The current contributor may not delete this post.',
  })
  deletePost(
    @Param('uuid')
    uuid: string,
    @Req()
    request: AuthenticatedRequest,
  ): Promise<void> {
    return this.blogAdminService.deletePost(
      uuid,
      request.user,
    );
  }
}
