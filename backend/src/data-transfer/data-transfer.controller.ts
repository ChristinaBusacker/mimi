import type {
  DataTransferImportResult,
  DataTransferProviderInfo,
  DataTransferValidationResult,
  MimiExport,
  MimiExportBundle,
} from '@shared/data-transfer/data-transfer';
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
  ApiBadRequestResponse,
  ApiCookieAuth,
  ApiNotFoundResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { AdminGuard } from '../auth/guards/admin.guard';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { AUTH_SESSION_COOKIE } from '../auth/session-cookie';
import type {
  AuthenticatedRequest,
} from '../auth/types/authenticated-request';
import { DataTransferService } from './data-transfer.service';

@ApiTags('Data transfer')
@ApiCookieAuth(AUTH_SESSION_COOKIE)
@Controller('admin/data-transfer')
@UseGuards(
  SessionAuthGuard,
  AdminGuard,
)
export class DataTransferController {
  constructor(
    private readonly dataTransfer:
      DataTransferService,
  ) {}

  @Get()
  @ApiOperation({
    summary:
      'List available data transfer providers',
  })
  listProviders():
    DataTransferProviderInfo[] {
    return this.dataTransfer
      .listProviders();
  }

  @Get('bundle')
  @ApiOperation({
    summary:
      'Export all registered data transfer sections as one bundle',
  })
  exportAll():
    Promise<MimiExportBundle> {
    return this.dataTransfer
      .exportAll();
  }

  @Get(':type/export')
  @ApiOperation({
    summary:
      'Export one data transfer section',
  })
  @ApiNotFoundResponse({
    description:
      'The requested data transfer provider does not exist.',
  })
  export(
    @Param('type')
    type: string,
  ): Promise<MimiExport> {
    return this.dataTransfer.export(type);
  }

  @Post(':type/validate')
  @ApiOperation({
    summary:
      'Validate and preview one import without changing data',
  })
  @ApiBadRequestResponse({
    description:
      'The import payload is invalid or incompatible.',
  })
  @ApiNotFoundResponse({
    description:
      'The requested data transfer provider does not exist.',
  })
  validateImport(
    @Param('type')
    type: string,
    @Body()
    payload: unknown,
  ): Promise<DataTransferValidationResult> {
    return this.dataTransfer
      .validateImport(
        type,
        payload,
      );
  }

  @Post(':type/import')
  @ApiOperation({
    summary:
      'Import one validated data transfer section',
  })
  @ApiBadRequestResponse({
    description:
      'The import payload is invalid or incompatible.',
  })
  @ApiNotFoundResponse({
    description:
      'The requested data transfer provider does not exist.',
  })
  import(
    @Param('type')
    type: string,
    @Body()
    payload: unknown,
    @Req()
    request: AuthenticatedRequest,
  ): Promise<DataTransferImportResult> {
    return this.dataTransfer.import(
      type,
      payload,
      {
        userUuid: request.user.uuid,
      },
    );
  }
}
