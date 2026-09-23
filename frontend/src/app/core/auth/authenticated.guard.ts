import { inject } from '@angular/core';
import {
  CanActivateFn,
  Router,
} from '@angular/router';
import { Store } from '@ngxs/store';
import { map } from 'rxjs';

import { LoadAuthSession } from './auth.actions';
import { AuthState } from './auth.state';

export const authenticatedGuard:
  CanActivateFn = () => {
    const store = inject(Store);
    const router = inject(Router);

    return store
      .dispatch(
        new LoadAuthSession(),
      )
      .pipe(
        map(() =>
          store.selectSnapshot(
            AuthState.user,
          )
            ? true
            : router.createUrlTree([
                '/admin/login',
              ]),
        ),
      );
  };
