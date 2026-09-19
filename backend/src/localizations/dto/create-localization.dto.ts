import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateLocalizationDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  key!: string;

  @IsString()
  de!: string;

  @IsString()
  en!: string;
}
