import {
  Body,
  Controller,
  Get,
  Param,
  Put,
  UseGuards,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { AdminGuard } from '../auth/guards/admin.guard';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { AUTH_SESSION_COOKIE } from '../auth/session-cookie';
import { BlogAdminService } from './blog-admin.service';
import {
  BlogAdminAuthorCandidateDto,
  BlogAdminAuthorDto,
} from './dto/blog-admin-response.dto';
import { SaveBlogAdminAuthorDto } from './dto/save-blog.dto';

@ApiTags('Admin Blog Authors')
@ApiCookieAuth(AUTH_SESSION_COOKIE)
@UseGuards(
  SessionAuthGuard,
  AdminGuard,
)
@Controller('admin/blog/authors')
export class BlogAdminAuthorsController {
  constructor(
    private readonly blogAdminService:
      BlogAdminService,
  ) {}

  @Get('candidates')
  @ApiOperation({
    summary:
      'List users that can be configured as blog authors',
  })
  @ApiOkResponse({
    type: BlogAdminAuthorCandidateDto,
    isArray: true,
  })
  getCandidates():
    Promise<BlogAdminAuthorCandidateDto[]> {
    return this.blogAdminService
      .getAuthorCandidates();
  }

  @Put(':userUuid')
  @ApiOperation({
    summary:
      'Create or update a blog author profile',
  })
  @ApiOkResponse({
    type: BlogAdminAuthorDto,
  })
  @ApiNotFoundResponse({
    description:
      'The user does not exist.',
  })
  saveAuthor(
    @Param('userUuid')
    userUuid: string,
    @Body()
    dto: SaveBlogAdminAuthorDto,
  ): Promise<BlogAdminAuthorDto> {
    return this.blogAdminService.saveAuthor(
      userUuid,
      dto,
    );
  }
}
