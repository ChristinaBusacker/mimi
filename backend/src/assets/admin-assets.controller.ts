import type { AssetType } from '@shared/assets/asset';

import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Param,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
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

import { ContributorGuard } from '../auth/guards/contributor.guard';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { AUTH_SESSION_COOKIE } from '../auth/session-cookie';
import { AssetDto } from './dto/asset.dto';
import { AssetFolderDto } from './dto/asset-folder.dto';
import { UpdateAssetDescriptionsDto } from './dto/update-asset-descriptions.dto';
import { MoveAssetsDto } from './dto/move-assets.dto';
import type { UploadedAssetFile } from './asset-file';
import { AssetsService } from './assets.service';

@ApiTags('Admin Assets')
@ApiCookieAuth(AUTH_SESSION_COOKIE)
@UseGuards(SessionAuthGuard, ContributorGuard)
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
    @Query('folderId') folderId?: string,
  ): Promise<AssetDto> {
    if (!file) {
      throw new BadRequestException(
        'A file field named "file" is required.',
      );
    }

    return this.assetsService.create(file, folderId || null);
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


  @Get('image-presets')
  getImagePresets() {
    return this.assetsService.getImagePresets();
  }

  @Get('folders')
  @ApiOkResponse({ type: AssetFolderDto, isArray: true })
  getFolders(): Promise<AssetFolderDto[]> {
    return this.assetsService.getFolders();
  }

  @Post('folders')
  @ApiCreatedResponse({ type: AssetFolderDto })
  createFolder(@Body() body: { name: string; parentId?: string | null }): Promise<AssetFolderDto> {
    return this.assetsService.createFolder(body.name, body.parentId ?? null);
  }

  @Patch('folders/:uuid')
  @ApiOperation({ summary: 'Rename a media folder' })
  @ApiOkResponse({ type: AssetFolderDto })
  renameFolder(@Param('uuid') uuid: string, @Body() body: { name: string }): Promise<AssetFolderDto> {
    return this.assetsService.renameFolder(uuid, body.name);
  }

  @Delete('folders/:uuid')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteFolder(@Param('uuid') uuid: string): Promise<void> {
    return this.assetsService.deleteFolder(uuid);
  }

  @Patch('bulk/folder')
  @ApiOperation({ summary: 'Move multiple assets to the same folder' })
  @ApiOkResponse({ type: AssetDto, isArray: true })
  moveAssets(@Body() input: MoveAssetsDto): Promise<AssetDto[]> {
    return this.assetsService.moveAssets(input.ids, input.folderId);
  }

  @Patch(':uuid/folder')
  moveAsset(@Param('uuid') uuid: string, @Body() body: { folderId: string | null }): Promise<AssetDto> {
    return this.assetsService.moveAsset(uuid, body.folderId ?? null);
  }

  @Post(':uuid/replace')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Replace image binary while preserving asset references' })
  @ApiOkResponse({ type: AssetDto })
  replaceImage(@Param('uuid') uuid: string, @UploadedFile() file?: UploadedAssetFile): Promise<AssetDto> {
    if (!file) throw new BadRequestException('Image file required.');
    return this.assetsService.replaceImage(uuid, file);
  }

  @Patch(':uuid/image-edits')
  @ApiOperation({ summary: 'Save non-destructive image edits and thumbnail crop' })
  @ApiOkResponse({ type: AssetDto })
  updateImageEdits(
    @Param('uuid') uuid: string,
    @Body() edits: unknown,
  ): Promise<AssetDto> {
    return this.assetsService.updateImageEdits(uuid, edits);
  }

  @Patch(':uuid/descriptions')
  @ApiOperation({
    summary: 'Update localized image descriptions',
  })
  @ApiOkResponse({
    type: AssetDto,
  })
  updateDescriptions(
    @Param('uuid') uuid: string,
    @Body() dto: UpdateAssetDescriptionsDto,
  ): Promise<AssetDto> {
    return this.assetsService.updateDescriptions(
      uuid,
      dto,
    );
  }

  @Get(':uuid/usages')
  @ApiOperation({ summary: 'List content references to an asset before deletion' })
  getUsages(@Param('uuid') uuid: string): Promise<Array<{ ownerType: string; ownerUuid: string; scope: string }>> {
    return this.assetsService.getUsages(uuid);
  }

  @Delete(':uuid')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete an asset',
  })
  @ApiNoContentResponse({
    description: 'The asset was deleted.',
  })
  @ApiConflictResponse({
    description:
      'The asset is still referenced by content.',
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
