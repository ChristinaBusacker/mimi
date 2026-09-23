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
  Router,
  RouterLink,
} from '@angular/router';
import { Store } from '@ngxs/store';
import { firstValueFrom } from 'rxjs';

import { Button } from '../../../components/button/button';
import { Login } from '../../../core/auth/auth.actions';
import { I18nPipe } from '../../../core/i18n/i18n.pipe';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AsyncPipe,
    Button,
    I18nPipe,
    ReactiveFormsModule,
    RouterLink,
  ],
  selector: 'app-admin-login',
  styleUrl: './admin-login.scss',
  templateUrl: './admin-login.html',
})
export class AdminLogin {
  private readonly store = inject(Store);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly submitting = signal(false);
  protected readonly errorKey = signal<string | null>(
    this.route.snapshot.queryParamMap.get('denied') === '1'
      ? 'admin.login.accessDenied'
      : null,
  );

  protected readonly form = new FormGroup({
    email: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.email,
      ],
    }),
    password: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
      ],
    }),
  });

  protected async submit(): Promise<void> {
    if (this.form.invalid || this.submitting()) {
      this.form.markAllAsTouched();

      return;
    }

    this.submitting.set(true);
    this.errorKey.set(null);

    try {
      const { email, password } = this.form.getRawValue();

      await firstValueFrom(
        this.store.dispatch(
          new Login(email, password),
        ),
      );

      await this.router.navigate(['/admin']);
    } catch (error: unknown) {
      this.errorKey.set(
        error instanceof HttpErrorResponse &&
          error.status === 401
          ? 'admin.login.invalidCredentials'
          : 'admin.login.failed',
      );
    } finally {
      this.submitting.set(false);
    }
  }
}
