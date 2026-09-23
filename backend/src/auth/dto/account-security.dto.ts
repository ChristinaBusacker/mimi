import type { AccountSecurity } from '@shared/auth/account-security';

import { ApiProperty } from '@nestjs/swagger';

export class AccountSecurityDto
  implements AccountSecurity
{
  @ApiProperty({
    format: 'email',
  })
  email!: string;

  @ApiProperty()
  hasPassword!: boolean;

  @ApiProperty()
  discordConnected!: boolean;
}
