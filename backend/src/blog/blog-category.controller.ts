import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
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
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { ContributorGuard } from '../auth/guards/contributor.guard';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { AUTH_SESSION_COOKIE } from '../auth/session-cookie';
import type { AuthenticatedRequest } from '../auth/types/authenticated-request';
import { BlogCategoryService } from './blog-category.service';
import { BlogAdminCategoryDto } from './dto/blog-admin-response.dto';
import { SaveBlogAdminCategoryDto } from './dto/save-blog.dto';

@ApiTags('Admin Blog Categories')
@ApiCookieAuth(AUTH_SESSION_COOKIE)
@UseGuards(
  SessionAuthGuard,
  ContributorGuard,
)
@Controller('admin/blog/categories')
export class BlogCategoryController {
  constructor(
    private readonly categories:
      BlogCategoryService,
  ) {}

  @Get()
  @ApiOperation({
    summary:
      'List blog categories',
  })
  @ApiOkResponse({
    type: BlogAdminCategoryDto,
    isArray: true,
  })
  getAll():
    Promise<BlogAdminCategoryDto[]> {
    return this.categories
      .getAdminCategories();
  }

  @Post()
  @ApiOperation({
    summary:
      'Create a blog category',
  })
  @ApiCreatedResponse({
    type: BlogAdminCategoryDto,
  })
  create(
    @Req()
    request: AuthenticatedRequest,
    @Body()
    dto: SaveBlogAdminCategoryDto,
  ): Promise<BlogAdminCategoryDto> {
    this.assertCanManage(
      request,
    );

    return this.categories.create(
      dto,
    );
  }

  @Patch(':uuid')
  @ApiOperation({
    summary:
      'Update a blog category',
  })
  @ApiOkResponse({
    type: BlogAdminCategoryDto,
  })
  update(
    @Req()
    request: AuthenticatedRequest,
    @Param('uuid')
    uuid: string,
    @Body()
    dto: SaveBlogAdminCategoryDto,
  ): Promise<BlogAdminCategoryDto> {
    this.assertCanManage(
      request,
    );

    return this.categories.update(
      uuid,
      dto,
    );
  }

  @Delete(':uuid')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary:
      'Delete a blog category',
  })
  @ApiNoContentResponse()
  delete(
    @Req()
    request: AuthenticatedRequest,
    @Param('uuid')
    uuid: string,
  ): Promise<void> {
    this.assertCanManage(
      request,
    );

    return this.categories.delete(
      uuid,
    );
  }

  private assertCanManage(
    request: AuthenticatedRequest,
  ): void {
    if (
      request.user.role !== 'editor' &&
      request.user.role !== 'admin'
    ) {
      throw new ForbiddenException();
    }
  }
}
