import { ApiProperty } from '@nestjs/swagger';

export class LocalizationResponseDto {
  @ApiProperty({
    format: 'uuid',
  })
  uuid!: string;

  @ApiProperty({
    example: 'hero.subtitle',
  })
  key!: string;

  @ApiProperty({
    example: 'Live-Musik mit Mimi.',
  })
  de!: string;

  @ApiProperty({
    example: 'Live music with Mimi.',
  })
  en!: string;
}
