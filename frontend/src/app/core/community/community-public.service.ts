import type {
  CommunityPublicSummary,
} from '@shared/community/community-public';

import {
  Injectable,
  inject,
} from '@angular/core';
import type {
  Observable,
} from 'rxjs';

import { RequestService } from '../http/request.service';

@Injectable({
  providedIn: 'root',
})
export class CommunityPublicService {
  private readonly request =
    inject(RequestService);

  getSummary():
    Observable<CommunityPublicSummary> {
    return this.request.get<
      CommunityPublicSummary
    >('/community/summary', {
      transferCache: true,
    });
  }
}
