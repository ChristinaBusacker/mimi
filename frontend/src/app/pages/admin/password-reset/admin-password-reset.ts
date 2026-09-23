import { AsyncPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
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
  RouterLink,
} from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { Button } from '../../../components/button/button';
import { PasswordResetService } from '../../../core/auth/password-reset.service';
import { I18nPipe } from '../../../core/i18n/i18n.pipe';

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
    'app-admin-password-reset',
  styleUrl:
    './admin-password-reset.scss',
  templateUrl:
    './admin-password-reset.html',
})
export class AdminPasswordReset {
  private readonly passwordReset =
    inject(PasswordResetService);
  private readonly route =
    inject(ActivatedRoute);

  protected readonly token =
    this.route.snapshot.queryParamMap
      .get('token')
      ?.trim() ?? '';

  protected readonly submitting =
    signal(false);
  protected readonly completed =
    signal(false);
  protected readonly errorKey =
    signal<string | null>(
      this.token
        ? null
        : 'admin.passwordReset.invalid',
    );

  protected readonly form =
    new FormGroup({
      password: new FormControl('', {
        nonNullable: true,
        validators: [
          Validators.required,
          Validators.minLength(10),
          Validators.maxLength(72),
        ],
      }),
      confirmation:
        new FormControl('', {
          nonNullable: true,
          validators: [
            Validators.required,
          ],
        }),
    });

  protected async submit():
    Promise<void> {
    if (
      !this.token ||
      this.form.invalid ||
      this.submitting()
    ) {
      this.form.markAllAsTouched();

      return;
    }

    const value =
      this.form.getRawValue();

    if (
      value.password !==
      value.confirmation
    ) {
      this.errorKey.set(
        'admin.passwordReset.mismatch',
      );

      return;
    }

    if (
      new TextEncoder()
        .encode(value.password)
        .byteLength > 72
    ) {
      this.errorKey.set(
        'admin.passwordReset.tooLong',
      );

      return;
    }

    this.submitting.set(true);
    this.errorKey.set(null);

    try {
      await firstValueFrom(
        this.passwordReset.resetPassword(
          this.token,
          value.password,
        ),
      );

      this.completed.set(true);
      this.form.disable();
    } catch (error: unknown) {
      this.errorKey.set(
        error instanceof HttpErrorResponse &&
          error.status === 400
          ? 'admin.passwordReset.invalid'
          : 'admin.passwordReset.failed',
      );
    } finally {
      this.submitting.set(false);
    }
  }
}
