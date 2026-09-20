import { AsyncPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  inject,
} from '@angular/core';
import {
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import { Store } from '@ngxs/store';
import { firstValueFrom } from 'rxjs';

import { Button } from '../../../components/button/button';
import { Logout } from '../../../core/auth/auth.actions';
import { AuthState } from '../../../core/auth/auth.state';
import { I18nPipe } from '../../../core/i18n/i18n.pipe';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AsyncPipe,
    Button,
    I18nPipe,
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
  ],
  selector: 'app-admin-shell',
  styleUrl: './admin-shell.scss',
  templateUrl: './admin-shell.html',
})
export class AdminShell {
  private readonly store = inject(Store);
  private readonly router = inject(Router);

  protected readonly user = this.store.selectSignal(
    AuthState.user,
  );

  protected async logout(): Promise<void> {
    await firstValueFrom(
      this.store.dispatch(new Logout()),
    );

    await this.router.navigate(['/admin/login']);
  }
}
