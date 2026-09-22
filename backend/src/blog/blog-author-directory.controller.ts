import {
  Controller,
  Get,
  UseGuards,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { AUTH_SESSION_COOKIE } from '../auth/session-cookie';
import { BlogAuthorDirectoryService } from './blog-author-directory.service';
import { BlogAdminAuthorDto } from './dto/blog-admin-response.dto';
import { BlogContributorGuard } from './guards/blog-contributor.guard';

@ApiTags('Admin Blog Authors')
@ApiCookieAuth(AUTH_SESSION_COOKIE)
@UseGuards(
  SessionAuthGuard,
  BlogContributorGuard,
)
@Controller('admin/blog/authors')
export class BlogAuthorDirectoryController {
  constructor(
    private readonly directory:
      BlogAuthorDirectoryService,
  ) {}

  @Get()
  @ApiOperation({
    summary:
      'List configured blog authors',
  })
  @ApiOkResponse({
    type: BlogAdminAuthorDto,
    isArray: true,
  })
  getAuthors():
    Promise<BlogAdminAuthorDto[]> {
    return this.directory.getAuthors();
  }
}
