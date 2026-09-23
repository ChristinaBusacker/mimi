import { AsyncPipe } from '@angular/common';
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
import { RouterLink } from '@angular/router';
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
    'app-admin-password-forgot',
  styleUrl:
    './admin-password-forgot.scss',
  templateUrl:
    './admin-password-forgot.html',
})
export class AdminPasswordForgot {
  private readonly passwordReset =
    inject(PasswordResetService);

  protected readonly submitting =
    signal(false);
  protected readonly sent =
    signal(false);
  protected readonly errorKey =
    signal<string | null>(null);

  protected readonly form =
    new FormGroup({
      email: new FormControl('', {
        nonNullable: true,
        validators: [
          Validators.required,
          Validators.email,
        ],
      }),
    });

  protected async submit():
    Promise<void> {
    if (
      this.form.invalid ||
      this.submitting()
    ) {
      this.form.markAllAsTouched();

      return;
    }

    this.submitting.set(true);
    this.errorKey.set(null);

    try {
      await firstValueFrom(
        this.passwordReset.requestReset(
          this.form.controls.email.value,
        ),
      );

      this.sent.set(true);
      this.form.disable();
    } catch {
      this.errorKey.set(
        'admin.passwordForgot.failed',
      );
    } finally {
      this.submitting.set(false);
    }
  }
}
