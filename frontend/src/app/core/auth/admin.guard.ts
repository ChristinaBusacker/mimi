import { inject } from '@angular/core';
import {
  CanActivateFn,
  Router,
} from '@angular/router';
import { Store } from '@ngxs/store';
import { map } from 'rxjs';

import { LoadAuthSession } from './auth.actions';
import { AuthState } from './auth.state';

export const adminGuard: CanActivateFn = () => {
  const store = inject(Store);
  const router = inject(Router);

  return store.dispatch(new LoadAuthSession()).pipe(
    map(() => {
      const user = store.selectSnapshot(AuthState.user);

      if (user?.role === 'admin') {
        return true;
      }

      return router.createUrlTree(
        ['/admin/login'],
        {
          queryParams: user
            ? {
                denied: '1',
              }
            : undefined,
        },
      );
    }),
  );
};
