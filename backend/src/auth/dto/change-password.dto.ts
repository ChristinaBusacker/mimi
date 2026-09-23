import type { ChangePasswordInput } from '@shared/auth/account-security';

import { ApiProperty } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class ChangePasswordDto
  implements ChangePasswordInput
{
  @ApiProperty({
    format: 'password',
    required: false,
    nullable: true,
    writeOnly: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(72)
  currentPassword!: string | null;

  @ApiProperty({
    format: 'password',
    minLength: 10,
    maxLength: 72,
    writeOnly: true,
  })
  @IsString()
  @MinLength(10)
  @MaxLength(72)
  password!: string;
}
