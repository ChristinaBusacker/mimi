import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({
    example: 'mimi@example.com',
    format: 'email',
  })
  email!: string;

  @ApiProperty({
    format: 'password',
    writeOnly: true,
  })
  password!: string;
}
