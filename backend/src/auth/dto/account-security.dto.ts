import type { AccountSecurity } from '@shared/auth/account-security';

import { ApiProperty } from '@nestjs/swagger';

export class AccountSecurityDto
  implements AccountSecurity
{
  @ApiProperty({
    nullable: true,
    format: 'email',
  })
  email!: string | null;

  @ApiProperty()
  hasPassword!: boolean;

  @ApiProperty()
  discordConnected!: boolean;
}
