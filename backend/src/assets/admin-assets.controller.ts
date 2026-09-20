import type { AssetType } from '@shared/assets/asset';

import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Param,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConsumes,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';

import { AdminGuard } from '../auth/guards/admin.guard';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { AUTH_SESSION_COOKIE } from '../auth/session-cookie';
import { AssetDto } from './dto/asset.dto';
import type { UploadedAssetFile } from './asset-file';
import { AssetsService } from './assets.service';

@ApiTags('Admin Assets')
@ApiCookieAuth(AUTH_SESSION_COOKIE)
@UseGuards(SessionAuthGuard, AdminGuard)
@Controller('admin/assets')
export class AdminAssetsController {
  constructor(private readonly assetsService: AssetsService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({
    summary: 'Upload an asset',
  })
  @ApiConsumes('multipart/form-data')
  @ApiCreatedResponse({
    type: AssetDto,
  })
  @ApiBadRequestResponse({
    description: 'The uploaded file is missing or unsupported.',
  })
  async upload(
    @UploadedFile() file?: UploadedAssetFile,
  ): Promise<AssetDto> {
    if (!file) {
      throw new BadRequestException(
        'A file field named "file" is required.',
      );
    }

    return this.assetsService.create(file);
  }

  @Get()
  @ApiOperation({
    summary: 'List uploaded assets',
  })
  @ApiQuery({
    name: 'type',
    required: false,
    enum: ['image', 'audio'],
  })
  @ApiOkResponse({
    type: AssetDto,
    isArray: true,
  })
  getAll(
    @Query('type') type?: string,
  ): Promise<AssetDto[]> {
    return this.assetsService.getAll(
      this.resolveAssetType(type),
    );
  }

  @Delete(':uuid')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete an asset',
  })
  @ApiNoContentResponse({
    description: 'The asset was deleted.',
  })
  delete(
    @Param('uuid') uuid: string,
  ): Promise<void> {
    return this.assetsService.delete(uuid);
  }

  private resolveAssetType(
    type: string | undefined,
  ): AssetType | undefined {
    if (type === undefined) {
      return undefined;
    }

    if (type === 'image' || type === 'audio') {
      return type;
    }

    throw new BadRequestException(
      `Unsupported asset type "${type}".`,
    );
  }
}
