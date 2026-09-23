import type {
  BlogAdminCategory,
  SaveBlogAdminCategory,
} from '@shared/blog/blog-admin';

import { AsyncPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Store } from '@ngxs/store';
import { firstValueFrom } from 'rxjs';

import { Button } from '../../../../components/button/button';
import { AuthState } from '../../../../core/auth/auth.state';
import { AdminBlogService } from '../../../../core/blog/admin-blog.service';
import { I18nPipe } from '../../../../core/i18n/i18n.pipe';

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
    'app-admin-blog-categories',
  styleUrl:
    './admin-blog-categories.scss',
  templateUrl:
    './admin-blog-categories.html',
})
export class AdminBlogCategories
  implements OnInit
{
  private readonly blog =
    inject(AdminBlogService);
  private readonly store =
    inject(Store);

  private readonly user =
    this.store.selectSignal(
      AuthState.user,
    );

  protected readonly categories =
    signal<BlogAdminCategory[]>([]);
  protected readonly selected =
    signal<BlogAdminCategory | null>(
      null,
    );
  protected readonly loading =
    signal(true);
  protected readonly saving =
    signal(false);
  protected readonly error =
    signal(false);
  protected readonly canManage =
    computed(
      () =>
        this.user()?.role ===
          'editor' ||
        this.user()?.role ===
          'admin',
    );

  protected readonly form =
    new FormGroup({
      slug:
        new FormControl('', {
          nonNullable: true,
          validators: [
            Validators.required,
            Validators.pattern(
              /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
            ),
          ],
        }),
      nameDe:
        new FormControl('', {
          nonNullable: true,
          validators: [
            Validators.required,
          ],
        }),
      nameEn:
        new FormControl('', {
          nonNullable: true,
        }),
    });

  async ngOnInit():
    Promise<void> {
    await this.reload();

    if (!this.canManage()) {
      this.form.disable();
    }
  }

  protected createNew():
    void {
    if (!this.canManage()) {
      return;
    }

    this.selected.set(null);
    this.error.set(false);
    this.form.reset({
      slug: '',
      nameDe: '',
      nameEn: '',
    });
  }

  protected edit(
    category:
      BlogAdminCategory,
  ): void {
    this.selected.set(category);
    this.error.set(false);
    this.form.setValue({
      slug: category.slug,
      nameDe:
        category.translations.de
          .name,
      nameEn:
        category.translations.en
          ?.name ?? '',
    });
  }

  protected async save():
    Promise<void> {
    if (
      !this.canManage() ||
      this.form.invalid ||
      this.saving()
    ) {
      this.form.markAllAsTouched();

      return;
    }

    const value =
      this.form.getRawValue();
    const input:
      SaveBlogAdminCategory = {
        slug:
          value.slug.trim(),
        translations: {
          de: {
            name:
              value.nameDe.trim(),
          },
          en: value.nameEn.trim()
            ? {
                name:
                  value.nameEn.trim(),
              }
            : null,
        },
      };

    this.saving.set(true);
    this.error.set(false);

    try {
      const current =
        this.selected();
      const category =
        await firstValueFrom(
          current
            ? this.blog.updateCategory(
                current.id,
                input,
              )
            : this.blog.createCategory(
                input,
              ),
        );

      this.categories.update(
        (categories) =>
          [
            ...categories.filter(
              (candidate) =>
                candidate.id !==
                category.id,
            ),
            category,
          ].sort(
            (left, right) =>
              left.translations.de.name
                .localeCompare(
                  right.translations.de.name,
                ),
          ),
      );
      this.edit(category);
    } catch {
      this.error.set(true);
    } finally {
      this.saving.set(false);
    }
  }

  protected async remove(
    category:
      BlogAdminCategory,
  ): Promise<void> {
    if (!this.canManage()) {
      return;
    }

    this.error.set(false);

    try {
      await firstValueFrom(
        this.blog.deleteCategory(
          category.id,
        ),
      );

      this.categories.update(
        (categories) =>
          categories.filter(
            (candidate) =>
              candidate.id !==
              category.id,
          ),
      );
      this.createNew();
    } catch {
      this.error.set(true);
    }
  }

  private async reload():
    Promise<void> {
    this.loading.set(true);
    this.error.set(false);

    try {
      this.categories.set(
        await firstValueFrom(
          this.blog.getCategories(),
        ),
      );
    } catch {
      this.error.set(true);
    } finally {
      this.loading.set(false);
    }
  }
}
