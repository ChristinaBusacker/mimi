import type {
  AccountSecurity,
  ChangePasswordInput,
} from '@shared/auth/account-security';

import {
  Injectable,
  inject,
} from '@angular/core';
import type { Observable } from 'rxjs';

import { RequestService } from '../http/request.service';

@Injectable({
  providedIn: 'root',
})
export class AccountSecurityService {
  private readonly request =
    inject(RequestService);

  get():
    Observable<AccountSecurity> {
    return this.request.get<
      AccountSecurity
    >(
      '/auth/account/security',
      {
        deduplicateAcrossTabs:
          false,
        transferCache: false,
      },
    );
  }

  changePassword(
    input: ChangePasswordInput,
  ): Observable<AccountSecurity> {
    return this.request.put<
      AccountSecurity,
      ChangePasswordInput
    >(
      '/auth/account/password',
      input,
    );
  }

  disconnectDiscord():
    Observable<AccountSecurity> {
    return this.request.delete<
      AccountSecurity
    >(
      '/auth/account/discord',
    );
  }
}
