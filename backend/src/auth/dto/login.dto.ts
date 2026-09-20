import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsString,
  MinLength,
} from 'class-validator';

export class LoginDto {
  @ApiProperty({
    example: 'mimi@example.com',
    format: 'email',
  })
  @IsEmail()
  email!: string;

  @ApiProperty({
    format: 'password',
    writeOnly: true,
  })
  @IsString()
  @MinLength(1)
  password!: string;
}
