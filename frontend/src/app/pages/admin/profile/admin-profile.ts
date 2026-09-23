import type { Asset } from '@shared/assets/asset';

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
} from '@angular/forms';
import {
  firstValueFrom,
  forkJoin,
} from 'rxjs';

import { AssetPicker } from '../../../components/asset-picker/asset-picker';
import { Button } from '../../../components/button/button';
import { MarkdownEditor } from '../../../components/markdown-editor/markdown-editor';
import { AdminAssetsService } from '../../../core/assets/admin-assets.service';
import { I18nPipe } from '../../../core/i18n/i18n.pipe';
import { AdminUsersService } from '../../../core/users/admin-users.service';

@Component({
  changeDetection:
    ChangeDetectionStrategy.OnPush,
  imports: [
    AssetPicker,
    AsyncPipe,
    Button,
    I18nPipe,
    MarkdownEditor,
    ReactiveFormsModule,
  ],
  selector:
    'app-admin-profile',
  styleUrl:
    './admin-profile.scss',
  templateUrl:
    './admin-profile.html',
})
export class AdminProfile
  implements OnInit
{
  private readonly users =
    inject(AdminUsersService);
  private readonly assets =
    inject(AdminAssetsService);

  protected readonly images =
    signal<Asset[]>([]);
  protected readonly displayName =
    signal('');
  protected readonly slug =
    signal('');
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
      bio:
        new FormControl('', {
          nonNullable: true,
        }),
      avatarAssetId:
        new FormControl('', {
          nonNullable: true,
        }),
    });

  async ngOnInit():
    Promise<void> {
    this.loading.set(true);

    try {
      const result =
        await firstValueFrom(
          forkJoin({
            profile:
              this.users
                .getOwnProfile(),
            images:
              this.assets.getAll(
                'image',
              ),
          }),
        );

      this.images.set(
        result.images,
      );
      this.displayName.set(
        result.profile
          .displayName,
      );
      this.slug.set(
        result.profile.slug,
      );
      this.form.setValue({
        bio:
          result.profile.bio,
        avatarAssetId:
          result.profile
            .avatarAssetId ??
          '',
      });
    } catch {
      this.error.set(true);
    } finally {
      this.loading.set(false);
    }
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
    if (this.saving()) {
      return;
    }

    const value =
      this.form.getRawValue();

    this.saving.set(true);
    this.saved.set(false);
    this.error.set(false);

    try {
      await firstValueFrom(
        this.users.saveOwnProfile({
          bio: value.bio,
          avatarAssetId:
            value.avatarAssetId ||
            null,
        }),
      );

      this.saved.set(true);
    } catch {
      this.error.set(true);
    } finally {
      this.saving.set(false);
    }
  }
}
