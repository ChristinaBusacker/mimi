import { ApiProperty } from '@nestjs/swagger';

import type { AuthenticatedUser } from '../auth.service';

export class AuthenticatedUserDto implements AuthenticatedUser {
  @ApiProperty({
    format: 'uuid',
  })
  uuid!: string;

  @ApiProperty({
    example: 'Mimi',
  })
  name!: string;

  @ApiProperty({
    example: 'mimi@example.com',
    format: 'email',
  })
  email!: string;

  @ApiProperty({
    nullable: true,
    example: '123456789012345678',
  })
  discordId!: string | null;
}
