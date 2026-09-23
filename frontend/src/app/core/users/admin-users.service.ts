import type {
  ManagedUser,
  OwnProfile,
  SaveManagedUser,
  SaveOwnProfile,
} from '@shared/users/user';

import {
  Injectable,
  inject,
} from '@angular/core';
import type { Observable } from 'rxjs';

import { RequestService } from '../http/request.service';

@Injectable({
  providedIn: 'root',
})
export class AdminUsersService {
  private readonly request =
    inject(RequestService);

  getUsers():
    Observable<ManagedUser[]> {
    return this.request.get<
      ManagedUser[]
    >(
      '/admin/users',
      {
        deduplicateAcrossTabs:
          false,
        transferCache: false,
      },
    );
  }

  saveUser(
    id: string,
    input: SaveManagedUser,
  ): Observable<ManagedUser> {
    return this.request.put<
      ManagedUser,
      SaveManagedUser
    >(
      `/admin/users/${id}`,
      input,
    );
  }

  getOwnProfile():
    Observable<OwnProfile> {
    return this.request.get<
      OwnProfile
    >(
      '/account/profile',
      {
        deduplicateAcrossTabs:
          false,
        transferCache: false,
      },
    );
  }

  saveOwnProfile(
    input: SaveOwnProfile,
  ): Observable<OwnProfile> {
    return this.request.put<
      OwnProfile,
      SaveOwnProfile
    >(
      '/account/profile',
      input,
    );
  }
}
