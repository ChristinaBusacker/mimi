import {
  Controller,
  Get,
  HttpStatus,
  Param,
  Req,
  Res,
  StreamableFile,
} from '@nestjs/common';
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import type {
  Request,
  Response,
} from 'express';
import { createReadStream } from 'node:fs';

import {
  AssetsService,
  type ResolvedAssetFile,
} from './assets.service';

interface ByteRange {
  start: number;
  end: number;
}

@ApiTags('Assets')
@Controller('assets')
export class AssetsController {
  constructor(private readonly assetsService: AssetsService) {}

  @Get(':uuid/image/:variant/:format')
  @ApiOperation({
    summary: 'Get a generated image variant',
  })
  @ApiProduces(
    'image/jpeg',
    'image/png',
    'image/webp',
  )
  @ApiOkResponse({
    description: 'The generated image variant.',
  })
  @ApiNotFoundResponse({
    description: 'The image asset does not exist.',
  })
  async getImageVariant(
    @Param('uuid') uuid: string,
    @Param('variant') variant: string,
    @Param('format') format: string,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile | void> {
    const resolved =
      await this.assetsService.resolveImageVariant(
        uuid,
        variant,
        format,
      );

    return this.sendFile(
      resolved,
      request,
      response,
    );
  }

  @Get(':uuid')
  @ApiOperation({
    summary: 'Get an uploaded asset',
  })
  @ApiParam({
    name: 'uuid',
    format: 'uuid',
  })
  @ApiProduces(
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/avif',
    'audio/mpeg',
    'audio/mp4',
    'audio/ogg',
    'audio/wav',
  )
  @ApiOkResponse({
    description: 'The asset file.',
  })
  @ApiNotFoundResponse({
    description: 'The asset does not exist.',
  })
  async getAsset(
    @Param('uuid') uuid: string,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile | void> {
    const resolved = await this.assetsService.resolveFile(uuid);

    return this.sendFile(
      resolved,
      request,
      response,
    );
  }

  private sendFile(
    resolved: ResolvedAssetFile,
    request: Request,
    response: Response,
  ): StreamableFile | void {
    response.setHeader('Accept-Ranges', 'bytes');
    response.setHeader(
      'Cache-Control',
      'public, max-age=31536000, immutable',
    );
    response.setHeader(
      'Content-Type',
      resolved.mimeType,
    );

    const range = this.parseRange(
      request.headers.range,
      resolved.sizeBytes,
    );

    if (range === 'invalid') {
      response
        .status(HttpStatus.REQUESTED_RANGE_NOT_SATISFIABLE)
        .setHeader(
          'Content-Range',
          `bytes */${resolved.sizeBytes}`,
        );

      response.end();

      return;
    }

    if (range) {
      const length = range.end - range.start + 1;

      response.status(HttpStatus.PARTIAL_CONTENT);
      response.setHeader(
        'Content-Range',
        `bytes ${range.start}-${range.end}/${resolved.sizeBytes}`,
      );
      response.setHeader('Content-Length', String(length));

      return new StreamableFile(
        createReadStream(resolved.absolutePath, {
          start: range.start,
          end: range.end,
        }),
      );
    }

    response.setHeader(
      'Content-Length',
      String(resolved.sizeBytes),
    );

    return new StreamableFile(
      createReadStream(resolved.absolutePath),
    );
  }

  private parseRange(
    rangeHeader: string | undefined,
    size: number,
  ): ByteRange | 'invalid' | null {
    if (!rangeHeader) {
      return null;
    }

    const match = /^bytes=(\d*)-(\d*)$/.exec(
      rangeHeader.trim(),
    );

    if (!match) {
      return 'invalid';
    }

    const startValue = match[1] ?? '';
    const endValue = match[2] ?? '';

    if (!startValue && !endValue) {
      return 'invalid';
    }

    let start: number;
    let end: number;

    if (!startValue) {
      const suffixLength = Number(endValue);

      if (
        !Number.isInteger(suffixLength) ||
        suffixLength <= 0
      ) {
        return 'invalid';
      }

      start = Math.max(size - suffixLength, 0);
      end = size - 1;
    } else {
      start = Number(startValue);
      end = endValue
        ? Number(endValue)
        : size - 1;
    }

    if (
      !Number.isInteger(start) ||
      !Number.isInteger(end) ||
      start < 0 ||
      start >= size ||
      end < start
    ) {
      return 'invalid';
    }

    return {
      start,
      end: Math.min(end, size - 1),
    };
  }
}
