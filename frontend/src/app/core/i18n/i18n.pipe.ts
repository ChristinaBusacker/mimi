import { Pipe, PipeTransform, inject } from '@angular/core';
import { Store } from '@ngxs/store';
import { Observable, distinctUntilChanged, map } from 'rxjs';

import { I18nState } from './i18n.state';

@Pipe({
  name: 'i18n',
  standalone: true,
})
export class I18nPipe implements PipeTransform {
  private readonly store = inject(Store);

  transform(key: string): Observable<string> {
    return this.store.select(I18nState.currentDictionary).pipe(
      map((dictionary) => dictionary[key] ?? key),
      distinctUntilChanged(),
    );
  }
}
