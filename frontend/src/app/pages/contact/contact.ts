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
import { RouterLink } from '@angular/router';
import { Store } from '@ngxs/store';
import { firstValueFrom } from 'rxjs';

import type { ContactMessageRequest } from '@shared/contact/contact-message';

import { Hero } from '../../components/hero/hero';
import { RequestService } from '../../core/http/request.service';
import { I18nPipe } from '../../core/i18n/i18n.pipe';
import { I18nState } from '../../core/i18n/i18n.state';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AsyncPipe,
    Hero,
    I18nPipe,
    ReactiveFormsModule,
    RouterLink,
  ],
  selector: 'app-contact',
  styleUrl: './contact.scss',
  templateUrl: './contact.html',
})
export class Contact {
  private readonly request = inject(RequestService);
  private readonly store = inject(Store);

  protected readonly submitting = signal(false);
  protected readonly sent = signal(false);
  protected readonly errorKey = signal<string | null>(null);

  protected readonly form = new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.minLength(2),
        Validators.maxLength(100),
      ],
    }),
    email: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.email,
        Validators.maxLength(320),
      ],
    }),
    subject: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.minLength(3),
        Validators.maxLength(160),
      ],
    }),
    message: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.minLength(10),
        Validators.maxLength(5000),
      ],
    }),
    website: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.maxLength(200),
      ],
    }),
  });

  protected async submit(): Promise<void> {
    if (this.form.invalid || this.submitting()) {
      this.form.markAllAsTouched();

      return;
    }

    this.submitting.set(true);
    this.sent.set(false);
    this.errorKey.set(null);

    try {
      const value = this.form.getRawValue();
      const body: ContactMessageRequest = {
        ...value,
        language: this.store.selectSnapshot(I18nState.language),
      };

      await firstValueFrom(
        this.request.post<void, ContactMessageRequest>(
          '/contact',
          body,
        ),
      );

      this.form.reset({
        name: '',
        email: '',
        subject: '',
        message: '',
        website: '',
      });
      this.sent.set(true);
    } catch (error: unknown) {
      this.errorKey.set(
        error instanceof HttpErrorResponse &&
          error.status === 429
          ? 'contact.form.rateLimited'
          : 'contact.form.error',
      );
    } finally {
      this.submitting.set(false);
    }
  }
}
