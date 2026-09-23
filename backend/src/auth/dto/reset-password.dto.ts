import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty({
    writeOnly: true,
  })
  @IsString()
  @MinLength(32)
  @MaxLength(200)
  token!: string;

  @ApiProperty({
    format: 'password',
    writeOnly: true,
    minLength: 10,
    maxLength: 72,
  })
  @IsString()
  @MinLength(10)
  @MaxLength(72)
  password!: string;
}
