import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateLocalizationDto {
  @ApiPropertyOptional({
    example: 'hero.subtitle',
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  key?: string;

  @ApiPropertyOptional({
    example: 'Live-Musik mit Mimi.',
  })
  @IsOptional()
  @IsString()
  de?: string;

  @ApiPropertyOptional({
    example: 'Live music with Mimi.',
  })
  @IsOptional()
  @IsString()
  en?: string;
}
