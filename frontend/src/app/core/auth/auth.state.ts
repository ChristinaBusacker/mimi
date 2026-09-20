import type { AuthenticatedUser } from '@shared/auth/authenticated-user';

import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import {
  Action,
  Selector,
  State,
  StateContext,
} from '@ngxs/store';
import {
  Observable,
  catchError,
  of,
  tap,
  throwError,
} from 'rxjs';

import { RequestService } from '../http/request.service';
import {
  LoadAuthSession,
  Login,
  Logout,
} from './auth.actions';

interface AuthStateModel {
  user: AuthenticatedUser | null;
  initialized: boolean;
}

@State<AuthStateModel>({
  name: 'auth',
  defaults: {
    user: null,
    initialized: false,
  },
})
@Injectable()
export class AuthState {
  private readonly request = inject(RequestService);

  @Selector()
  static user(state: AuthStateModel): AuthenticatedUser | null {
    return state.user;
  }

  @Selector()
  static initialized(state: AuthStateModel): boolean {
    return state.initialized;
  }

  @Selector()
  static isAdmin(state: AuthStateModel): boolean {
    return state.user?.role === 'admin';
  }

  @Action(LoadAuthSession)
  loadSession(
    context: StateContext<AuthStateModel>,
  ): Observable<AuthenticatedUser> | void {
    if (context.getState().initialized) {
      return;
    }

    return this.request
      .get<AuthenticatedUser>('/auth/me', {
        deduplicateAcrossTabs: false,
        transferCache: false,
      })
      .pipe(
        tap((user) => {
          context.setState({
            user,
            initialized: true,
          });
        }),
        catchError((error: unknown) => {
          if (
            error instanceof HttpErrorResponse &&
            error.status === 401
          ) {
            context.setState({
              user: null,
              initialized: true,
            });

            return of();
          }

          return throwError(() => error);
        }),
      );
  }

  @Action(Login)
  login(
    context: StateContext<AuthStateModel>,
    { email, password }: Login,
  ): Observable<AuthenticatedUser> {
    return this.request
      .post<
        AuthenticatedUser,
        {
          email: string;
          password: string;
        }
      >('/auth/login', {
        email,
        password,
      })
      .pipe(
        tap((user) => {
          context.setState({
            user,
            initialized: true,
          });
        }),
      );
  }

  @Action(Logout)
  logout(
    context: StateContext<AuthStateModel>,
  ): Observable<void> {
    return this.request
      .post<void, Record<string, never>>(
        '/auth/logout',
        {},
      )
      .pipe(
        tap(() => {
          context.setState({
            user: null,
            initialized: true,
          });
        }),
      );
  }
}
