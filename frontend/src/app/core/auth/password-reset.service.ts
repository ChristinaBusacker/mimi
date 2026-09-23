import {
  Injectable,
  inject,
} from '@angular/core';
import { Observable } from 'rxjs';

import { RequestService } from '../http/request.service';

@Injectable({
  providedIn: 'root',
})
export class PasswordResetService {
  private readonly request =
    inject(RequestService);

  requestReset(
    email: string,
  ): Observable<void> {
    return this.request.post<
      void,
      { email: string }
    >(
      '/auth/password/forgot',
      { email },
    );
  }

  resetPassword(
    token: string,
    password: string,
  ): Observable<void> {
    return this.request.post<
      void,
      {
        token: string;
        password: string;
      }
    >(
      '/auth/password/reset',
      {
        token,
        password,
      },
    );
  }
}
