import type {
  ManagedUser,
  OwnProfile,
} from '@shared/users/user';

import {
  Body,
  Controller,
  Get,
  Param,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { AdminGuard } from '../auth/guards/admin.guard';
import { ContributorGuard } from '../auth/guards/contributor.guard';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { AUTH_SESSION_COOKIE } from '../auth/session-cookie';
import type { AuthenticatedRequest } from '../auth/types/authenticated-request';
import {
  SaveManagedUserDto,
  SaveOwnProfileDto,
} from './dto/save-user-management.dto';
import { UserManagementService } from './user-management.service';

@ApiTags('User management')
@ApiCookieAuth(AUTH_SESSION_COOKIE)
@Controller()
export class UserManagementController {
  constructor(
    private readonly users:
      UserManagementService,
  ) {}

  @Get('admin/users')
  @UseGuards(
    SessionAuthGuard,
    AdminGuard,
  )
  @ApiOperation({
    summary:
      'List users and roles',
  })
  getUsers():
    Promise<ManagedUser[]> {
    return this.users.getUsers();
  }

  @Put('admin/users/:uuid')
  @UseGuards(
    SessionAuthGuard,
    AdminGuard,
  )
  @ApiOperation({
    summary:
      'Update role and public author identity',
  })
  saveUser(
    @Param('uuid')
    uuid: string,
    @Body()
    dto: SaveManagedUserDto,
  ): Promise<ManagedUser> {
    return this.users.saveUser(
      uuid,
      dto,
    );
  }

  @Get('account/profile')
  @UseGuards(
    SessionAuthGuard,
    ContributorGuard,
  )
  @ApiOperation({
    summary:
      'Get the current public profile',
  })
  getOwnProfile(
    @Req()
    request: AuthenticatedRequest,
  ): Promise<OwnProfile> {
    return this.users.getOwnProfile(
      request.user,
    );
  }

  @Put('account/profile')
  @UseGuards(
    SessionAuthGuard,
    ContributorGuard,
  )
  @ApiOperation({
    summary:
      'Update the current public profile',
  })
  saveOwnProfile(
    @Req()
    request: AuthenticatedRequest,
    @Body()
    dto: SaveOwnProfileDto,
  ): Promise<OwnProfile> {
    return this.users.saveOwnProfile(
      request.user,
      dto,
    );
  }
}
