import type {
  GamingLocale,
  GamingNextStream,
} from '@shared/gaming/gaming';

import {
  Injectable,
  inject,
} from '@angular/core';
import { Observable } from 'rxjs';

import { RequestService } from '../http/request.service';

@Injectable({
  providedIn: 'root',
})
export class GamingService {
  private readonly request =
    inject(RequestService);

  getNextStream(
    locale: GamingLocale,
  ): Observable<GamingNextStream> {
    return this.request.get<GamingNextStream>(
      `/gaming/next-stream?locale=${encodeURIComponent(locale)}`,
    );
  }
}
