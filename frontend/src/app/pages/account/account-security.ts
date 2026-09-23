import type { AccountSecurity } from '@shared/auth/account-security';

import { AsyncPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import {
  ActivatedRoute,
  Router,
  RouterLink,
} from '@angular/router';
import { Store } from '@ngxs/store';
import {
  firstValueFrom,
} from 'rxjs';

import { Button } from '../../components/button/button';
import { AccountSecurityService } from '../../core/auth/account-security.service';
import { Logout } from '../../core/auth/auth.actions';
import { AuthState } from '../../core/auth/auth.state';
import { I18nPipe } from '../../core/i18n/i18n.pipe';

@Component({
  changeDetection:
    ChangeDetectionStrategy.OnPush,
  imports: [
    AsyncPipe,
    Button,
    I18nPipe,
    ReactiveFormsModule,
    RouterLink,
  ],
  selector:
    'app-account-security',
  styleUrl:
    './account-security.scss',
  templateUrl:
    './account-security.html',
})
export class AccountSecurityPage
  implements OnInit
{
  private readonly account =
    inject(
      AccountSecurityService,
    );
  private readonly route =
    inject(ActivatedRoute);
  private readonly store =
    inject(Store);
  private readonly router =
    inject(Router);

  protected readonly user =
    this.store.selectSignal(
      AuthState.user,
    );
  protected readonly security =
    signal<AccountSecurity | null>(
      null,
    );
  protected readonly loading =
    signal(true);
  protected readonly savingPassword =
    signal(false);
  protected readonly disconnecting =
    signal(false);
  protected readonly errorKey =
    signal<string | null>(
      this.route.snapshot
        .queryParamMap
        .get('discord') ===
        'conflict'
        ? 'account.security.discordConflict'
        : null,
    );
  protected readonly successKey =
    signal<string | null>(
      this.route.snapshot
        .queryParamMap
        .get('discord') ===
        'connected'
        ? 'account.security.discordConnectedSuccess'
        : null,
    );

  protected readonly form =
    new FormGroup({
      currentPassword:
        new FormControl('', {
          nonNullable: true,
        }),
      password:
        new FormControl('', {
          nonNullable: true,
          validators: [
            Validators.required,
            Validators.minLength(
              10,
            ),
            Validators.maxLength(
              72,
            ),
          ],
        }),
      passwordConfirmation:
        new FormControl('', {
          nonNullable: true,
          validators: [
            Validators.required,
          ],
        }),
    });

  async ngOnInit():
    Promise<void> {
    await this.load();
  }

  protected async savePassword():
    Promise<void> {
    if (
      this.form.invalid ||
      this.savingPassword()
    ) {
      this.form.markAllAsTouched();

      return;
    }

    const security =
      this.security();

    if (!security) {
      return;
    }

    const value =
      this.form.getRawValue();

    if (
      value.password !==
      value.passwordConfirmation
    ) {
      this.errorKey.set(
        'account.security.passwordMismatch',
      );

      return;
    }

    this.savingPassword.set(
      true,
    );
    this.errorKey.set(null);
    this.successKey.set(null);

    try {
      const updated =
        await firstValueFrom(
          this.account.changePassword({
            currentPassword:
              security.hasPassword
                ? value.currentPassword
                : null,
            password:
              value.password,
          }),
        );

      this.security.set(
        updated,
      );
      this.form.reset();
      this.successKey.set(
        'account.security.passwordChanged',
      );
    } catch (error: unknown) {
      this.errorKey.set(
        error instanceof
            HttpErrorResponse &&
          error.status === 401
          ? 'account.security.currentPasswordInvalid'
          : 'account.security.passwordFailed',
      );
    } finally {
      this.savingPassword.set(
        false,
      );
    }
  }

  protected async disconnectDiscord():
    Promise<void> {
    if (this.disconnecting()) {
      return;
    }

    this.disconnecting.set(true);
    this.errorKey.set(null);
    this.successKey.set(null);

    try {
      const updated =
        await firstValueFrom(
          this.account
            .disconnectDiscord(),
        );

      this.security.set(
        updated,
      );
      this.successKey.set(
        'account.security.discordDisconnected',
      );
    } catch (error: unknown) {
      this.errorKey.set(
        error instanceof
            HttpErrorResponse &&
          error.status === 409
          ? 'account.security.discordRequiresPassword'
          : 'account.security.discordFailed',
      );
    } finally {
      this.disconnecting.set(false);
    }
  }

  protected canOpenAdmin():
    boolean {
    const role =
      this.user()?.role;

    return (
      role === 'author' ||
      role === 'editor' ||
      role === 'admin'
    );
  }

  private async load():
    Promise<void> {
    this.loading.set(true);
    this.errorKey.set(null);

    try {
      this.security.set(
        await firstValueFrom(
          this.account.get(),
        ),
      );
    } catch {
      this.errorKey.set(
        'account.security.loadFailed',
      );
    } finally {
      this.loading.set(false);
    }
  }

  protected async logout():
    Promise<void> {
    await firstValueFrom(
      this.store.dispatch(
        new Logout(),
      ),
    );

    await this.router.navigate([
      '/admin/login',
    ]);
  }
}
