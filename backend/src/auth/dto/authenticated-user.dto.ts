import type {
  AuthenticatedUser,
  UserRole,
} from '@shared/auth/authenticated-user';

import { ApiProperty } from '@nestjs/swagger';

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
    nullable: true,
    example: 'mimi@example.com',
    format: 'email',
  })
  email!: string | null;

  @ApiProperty({
    nullable: true,
    example: '123456789012345678',
  })
  discordId!: string | null;

  @ApiProperty({
    enum: ['user', 'author', 'editor', 'admin'],
  })
  role!: UserRole;
}
