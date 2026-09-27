import { Injectable } from '@nestjs/common';
import {
  Subject,
  type Observable,
} from 'rxjs';

@Injectable()
export class CommunityRewardSyncService {
  private readonly syncRequests =
    new Subject<string>();

  request(userUuid: string): void {
    const normalized =
      userUuid.trim();

    if (!normalized) {
      return;
    }

    this.syncRequests.next(
      normalized,
    );
  }

  requests(): Observable<string> {
    return this.syncRequests
      .asObservable();
  }
}
