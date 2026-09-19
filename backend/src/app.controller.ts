import { Controller, Get } from '@nestjs/common';

import type { HealthResponse } from '@shared/api/health-response';

@Controller()
export class AppController {
  @Get('health')
  getHealth(): HealthResponse {
    return {
      status: 'ok',
    };
  }
}
