import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { HealthResponseDto } from './dto/health-response.dto';

@ApiTags('System')
@Controller()
export class AppController {
  @Get('health')
  @ApiOperation({
    summary: 'Check API health',
  })
  @ApiOkResponse({
    description: 'The API is available.',
    type: HealthResponseDto,
  })
  getHealth(): HealthResponseDto {
    return {
      status: 'ok',
    };
  }
}
