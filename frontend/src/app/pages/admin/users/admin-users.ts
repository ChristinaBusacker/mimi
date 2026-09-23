import type {
  ManagedUser,
  SaveManagedUser,
} from '@shared/users/user';
import type {
  UserRole,
} from '@shared/auth/authenticated-user';

import { AsyncPipe } from '@angular/common';
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
import { firstValueFrom } from 'rxjs';

import { Button } from '../../../components/button/button';
import { I18nPipe } from '../../../core/i18n/i18n.pipe';
import { AdminUsersService } from '../../../core/users/admin-users.service';

@Component({
  changeDetection:
    ChangeDetectionStrategy.OnPush,
  imports: [
    AsyncPipe,
    Button,
    I18nPipe,
    ReactiveFormsModule,
  ],
  selector:
    'app-admin-users',
  styleUrl:
    './admin-users.scss',
  templateUrl:
    './admin-users.html',
})
export class AdminUsers
  implements OnInit
{
  private readonly service =
    inject(AdminUsersService);

  protected readonly users =
    signal<ManagedUser[]>([]);
  protected readonly selected =
    signal<ManagedUser | null>(
      null,
    );
  protected readonly loading =
    signal(true);
  protected readonly saving =
    signal(false);
  protected readonly saved =
    signal(false);
  protected readonly error =
    signal(false);

  protected readonly form =
    new FormGroup({
      role:
        new FormControl<UserRole>(
          'user',
          {
            nonNullable: true,
          },
        ),
      displayName:
        new FormControl('', {
          nonNullable: true,
          validators: [
            Validators.maxLength(
              255,
            ),
          ],
        }),
      slug:
        new FormControl('', {
          nonNullable: true,
          validators: [
            Validators.pattern(
              /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
            ),
          ],
        }),
    });

  async ngOnInit():
    Promise<void> {
    await this.reload();
  }

  protected edit(
    user: ManagedUser,
  ): void {
    this.selected.set(user);
    this.saved.set(false);
    this.error.set(false);

    this.form.setValue({
      role: user.role,
      displayName:
        user.profile
          ?.displayName ??
        user.name,
      slug:
        user.profile?.slug ??
        this.slugify(
          user.name,
        ),
    });
  }

  protected isContributor():
    boolean {
    const role =
      this.form.controls.role
        .value;

    return role === 'author' ||
      role === 'editor' ||
      role === 'admin';
  }

  protected async save():
    Promise<void> {
    const selected =
      this.selected();

    if (
      !selected ||
      this.form.invalid ||
      this.saving()
    ) {
      this.form.markAllAsTouched();

      return;
    }

    const value =
      this.form.getRawValue();
    const contributor =
      this.isContributor();
    const displayName =
      value.displayName.trim();
    const slug =
      value.slug.trim();

    if (
      contributor &&
      (
        !displayName ||
        !slug
      )
    ) {
      this.error.set(true);

      return;
    }

    const input:
      SaveManagedUser = {
        role: value.role,
        displayName:
          contributor
            ? displayName
            : null,
        slug: contributor
          ? slug
          : null,
      };

    this.saving.set(true);
    this.saved.set(false);
    this.error.set(false);

    try {
      const user =
        await firstValueFrom(
          this.service.saveUser(
            selected.id,
            input,
          ),
        );

      this.users.update(
        (users) =>
          users.map(
            (candidate) =>
              candidate.id ===
              user.id
                ? user
                : candidate,
          ),
      );
      this.selected.set(user);
      this.saved.set(true);
    } catch {
      this.error.set(true);
    } finally {
      this.saving.set(false);
    }
  }

  private async reload():
    Promise<void> {
    this.loading.set(true);
    this.error.set(false);

    try {
      this.users.set(
        await firstValueFrom(
          this.service.getUsers(),
        ),
      );
    } catch {
      this.error.set(true);
    } finally {
      this.loading.set(false);
    }
  }

  private slugify(
    value: string,
  ): string {
    return value
      .replace(/ß/g, 'ss')
      .normalize('NFKD')
      .replace(
        /[\u0300-\u036f]/g,
        '',
      )
      .toLowerCase()
      .replace(
        /[^a-z0-9]+/g,
        '-',
      )
      .replace(
        /^-+|-+$/g,
        '',
      )
      .slice(0, 160);
  }
}
