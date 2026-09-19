import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateLocalizationDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  key?: string;

  @IsOptional()
  @IsString()
  de?: string;

  @IsOptional()
  @IsString()
  en?: string;
}
