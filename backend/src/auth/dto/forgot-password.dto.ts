import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  MaxLength,
} from 'class-validator';

export class ForgotPasswordDto {
  @ApiProperty({
    example: 'mimi@example.com',
    format: 'email',
  })
  @IsEmail()
  @MaxLength(320)
  email!: string;
}
