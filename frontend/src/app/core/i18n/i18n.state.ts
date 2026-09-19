import { Injectable, inject } from '@angular/core';
import { Action, Selector, State, StateContext } from '@ngxs/store';
import { Observable, tap } from 'rxjs';

import { RequestService } from '../http/request.service';
import { SetLanguage } from './i18n.actions';
import {
  DEFAULT_LANGUAGE,
  type I18nStateModel,
  type Language,
  type LocalizationDictionary,
} from './i18n.types';

const EMPTY_DICTIONARY: LocalizationDictionary = {};

@State<I18nStateModel>({
  name: 'i18n',
  defaults: {
    language: DEFAULT_LANGUAGE,
    dictionaries: {},
  },
})
@Injectable()
export class I18nState {
  private readonly request = inject(RequestService);

  @Selector()
  static language(state: I18nStateModel): Language {
    return state.language;
  }

  @Selector()
  static currentDictionary(state: I18nStateModel): LocalizationDictionary {
    return state.dictionaries[state.language] ?? EMPTY_DICTIONARY;
  }

  @Action(SetLanguage)
  setLanguage(
    context: StateContext<I18nStateModel>,
    { language }: SetLanguage,
  ): Observable<LocalizationDictionary> | void {
    const currentState = context.getState();

    context.patchState({
      language,
    });

    if (currentState.dictionaries[language] !== undefined) {
      return;
    }

    return this.request
      .get<LocalizationDictionary>(`/localizations/locale/${language}`)
      .pipe(
        tap((dictionary) => {
          const state = context.getState();

          context.patchState({
            dictionaries: {
              ...state.dictionaries,
              [language]: dictionary,
            },
          });
        }),
      );
  }
}
