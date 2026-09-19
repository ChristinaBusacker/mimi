import { ApiProperty } from '@nestjs/swagger';

import type { HealthResponse } from '@shared/api/health-response';

export class HealthResponseDto implements HealthResponse {
  @ApiProperty({
    enum: ['ok'],
    example: 'ok',
  })
  status!: 'ok';
}
