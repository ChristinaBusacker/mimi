import type { Asset } from '@shared/assets/asset';
import type {
  BlogAdminAuthorCandidate,
  BlogContributorRole,
  SaveBlogAdminAuthor,
} from '@shared/blog/blog-admin';

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
import {
  firstValueFrom,
  forkJoin,
} from 'rxjs';

import { AssetPicker } from '../../../../components/asset-picker/asset-picker';
import { Button } from '../../../../components/button/button';
import { AdminAssetsService } from '../../../../core/assets/admin-assets.service';
import { AdminBlogService } from '../../../../core/blog/admin-blog.service';
import { I18nPipe } from '../../../../core/i18n/i18n.pipe';

@Component({
  changeDetection:
    ChangeDetectionStrategy.OnPush,
  imports: [
    AssetPicker,
    AsyncPipe,
    Button,
    I18nPipe,
    ReactiveFormsModule,
  ],
  selector:
    'app-admin-blog-authors',
  styleUrl:
    './admin-blog-authors.scss',
  templateUrl:
    './admin-blog-authors.html',
})
export class AdminBlogAuthors
  implements OnInit
{
  private readonly blog =
    inject(AdminBlogService);
  private readonly assets =
    inject(AdminAssetsService);

  protected readonly candidates =
    signal<
      BlogAdminAuthorCandidate[]
    >([]);
  protected readonly images =
    signal<Asset[]>([]);
  protected readonly selected =
    signal<
      BlogAdminAuthorCandidate | null
    >(null);
  protected readonly loading =
    signal(true);
  protected readonly saving =
    signal(false);
  protected readonly saved =
    signal(false);
  protected readonly errorKey =
    signal<string | null>(null);

  protected readonly form =
    new FormGroup({
      slug: new FormControl('', {
        nonNullable: true,
        validators: [
          Validators.required,
          Validators.pattern(
            /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
          ),
        ],
      }),
      displayName:
        new FormControl('', {
          nonNullable: true,
          validators: [
            Validators.required,
          ],
        }),
      bio: new FormControl('', {
        nonNullable: true,
      }),
      avatarAssetId:
        new FormControl('', {
          nonNullable: true,
        }),
      role:
        new FormControl<BlogContributorRole>(
          'author',
          {
            nonNullable: true,
          },
        ),
    });

  async ngOnInit(): Promise<void> {
    await this.reload();
  }

  protected edit(
    candidate:
      BlogAdminAuthorCandidate,
  ): void {
    this.selected.set(candidate);
    this.saved.set(false);
    this.errorKey.set(null);

    const profile =
      candidate.profile;

    this.form.setValue({
      slug:
        profile?.slug ??
        this.slugify(
          candidate.name,
        ),
      displayName:
        profile?.displayName ??
        candidate.name,
      bio:
        profile?.bio ?? '',
      avatarAssetId:
        profile?.avatarAssetId ??
        '',
      role:
        profile?.role === 'editor'
          ? 'editor'
          : 'author',
    });

    if (
      candidate.role === 'admin'
    ) {
      this.form.controls.role.disable();
    } else {
      this.form.controls.role.enable();
    }
  }

  protected closeEditor(): void {
    this.selected.set(null);
    this.saved.set(false);
    this.errorKey.set(null);
    this.form.reset({
      slug: '',
      displayName: '',
      bio: '',
      avatarAssetId: '',
      role: 'author',
    });
  }

  protected addImage(
    asset: Asset,
  ): void {
    this.images.update(
      (images) => [
        asset,
        ...images.filter(
          (candidate) =>
            candidate.id !==
            asset.id,
        ),
      ],
    );
  }

  protected removeImage(
    assetId: string,
  ): void {
    this.images.update(
      (images) =>
        images.filter(
          (asset) =>
            asset.id !==
            assetId,
        ),
    );
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
    const input:
      SaveBlogAdminAuthor = {
        slug:
          value.slug.trim(),
        displayName:
          value.displayName.trim(),
        bio:
          value.bio.trim(),
        avatarAssetId:
          value.avatarAssetId ||
          null,
        role:
          selected.role ===
          'admin'
            ? 'editor'
            : value.role,
      };

    this.saving.set(true);
    this.saved.set(false);
    this.errorKey.set(null);

    try {
      const profile =
        await firstValueFrom(
          this.blog.saveAuthor(
            selected.userId,
            input,
          ),
        );

      this.candidates.update(
        (candidates) =>
          candidates.map(
            (candidate) =>
              candidate.userId ===
              selected.userId
                ? {
                    ...candidate,
                    role:
                      profile.role,
                    profile,
                  }
                : candidate,
          ),
      );
      this.selected.set({
        ...selected,
        role: profile.role,
        profile,
      });
      this.saved.set(true);
    } catch {
      this.errorKey.set(
        'admin.blog.authors.saveFailed',
      );
    } finally {
      this.saving.set(false);
    }
  }

  private async reload():
    Promise<void> {
    this.loading.set(true);
    this.errorKey.set(null);

    try {
      const result =
        await firstValueFrom(
          forkJoin({
            candidates:
              this.blog.getAuthorCandidates(),
            images:
              this.assets.getAll(
                'image',
              ),
          }),
        );

      this.candidates.set(
        result.candidates,
      );
      this.images.set(
        result.images,
      );
    } catch {
      this.errorKey.set(
        'admin.blog.authors.loadFailed',
      );
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
