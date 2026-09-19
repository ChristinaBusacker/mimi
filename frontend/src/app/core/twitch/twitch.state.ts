import { Injectable, inject } from '@angular/core';
import { Action, Selector, State, StateContext } from '@ngxs/store';
import { EMPTY, Observable, catchError, tap } from 'rxjs';

import type { TwitchStatus } from '@shared/twitch/twitch-status';

import { RequestService } from '../http/request.service';
import { LoadTwitchStatus } from './twitch.actions';

interface TwitchStateModel {
  status: TwitchStatus | null;
}

@State<TwitchStateModel>({
  name: 'twitch',
  defaults: {
    status: null,
  },
})
@Injectable()
export class TwitchState {
  private readonly request = inject(RequestService);

  @Selector()
  static status(state: TwitchStateModel): TwitchStatus | null {
    return state.status;
  }

  @Action(LoadTwitchStatus, {
    cancelUncompleted: true,
  })
  loadStatus(
    context: StateContext<TwitchStateModel>,
  ): Observable<TwitchStatus> {
    return this.request.get<TwitchStatus>('/twitch/status').pipe(
      tap((status) => {
        context.patchState({
          status,
        });
      }),
      catchError(() => EMPTY),
    );
  }
}
