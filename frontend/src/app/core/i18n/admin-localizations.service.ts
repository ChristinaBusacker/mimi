import type {
  Localization,
  SaveLocalization,
} from '@shared/localizations/localization';

import {
  Injectable,
  inject,
} from '@angular/core';
import { Observable } from 'rxjs';

import { RequestService } from '../http/request.service';

@Injectable({
  providedIn: 'root',
})
export class AdminLocalizationsService {
  private readonly request = inject(RequestService);

  getAll(): Observable<Localization[]> {
    return this.request.get<Localization[]>(
      '/localizations',
      {
        deduplicateAcrossTabs: false,
        transferCache: false,
      },
    );
  }

  create(
    input: SaveLocalization,
  ): Observable<Localization> {
    return this.request.post<
      Localization,
      SaveLocalization
    >('/localizations', input);
  }

  update(
    uuid: string,
    input: SaveLocalization,
  ): Observable<Localization> {
    return this.request.patch<
      Localization,
      SaveLocalization
    >(`/localizations/${uuid}`, input);
  }

  delete(uuid: string): Observable<void> {
    return this.request.delete<void>(
      `/localizations/${uuid}`,
    );
  }
}
