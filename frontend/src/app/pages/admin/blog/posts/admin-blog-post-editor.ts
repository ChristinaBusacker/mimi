import type { Asset } from '@shared/assets/asset';
import type {
  BlogAdminAuthor,
  BlogAdminPost,
  SaveBlogAdminPost,
} from '@shared/blog/blog-admin';
import type { BlogPublicationStatus } from '@shared/blog/blog';

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
  ActivatedRoute,
  Router,
  RouterLink,
} from '@angular/router';
import { Store } from '@ngxs/store';
import {
  firstValueFrom,
  forkJoin,
} from 'rxjs';

import { AssetPicker } from '../../../../components/asset-picker/asset-picker';
import { Button } from '../../../../components/button/button';
import { MarkdownEditor } from '../../../../components/markdown-editor/markdown-editor';
import { AdminAssetsService } from '../../../../core/assets/admin-assets.service';
import { AuthState } from '../../../../core/auth/auth.state';
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
    MarkdownEditor,
    ReactiveFormsModule,
    RouterLink,
  ],
  selector:
    'app-admin-blog-post-editor',
  styleUrl:
    './admin-blog-post-editor.scss',
  templateUrl:
    './admin-blog-post-editor.html',
})
export class AdminBlogPostEditor
  implements OnInit
{
  private readonly blog =
    inject(AdminBlogService);
  private readonly assets =
    inject(AdminAssetsService);
  private readonly route =
    inject(ActivatedRoute);
  private readonly router =
    inject(Router);
  private readonly store =
    inject(Store);

  protected readonly postId =
    this.route.snapshot.paramMap.get(
      'id',
    );
  protected readonly user =
    this.store.selectSignal(
      AuthState.user,
    );
  protected readonly images =
    signal<Asset[]>([]);
  protected readonly authors =
    signal<BlogAdminAuthor[]>([]);
  protected readonly loading =
    signal(true);
  protected readonly saving =
    signal(false);
  protected readonly saved =
    signal(false);
  protected readonly readOnly =
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
      authorId:
        new FormControl('', {
          nonNullable: true,
          validators: [
            Validators.required,
          ],
        }),
      coverAssetId:
        new FormControl('', {
          nonNullable: true,
        }),
      status:
        new FormControl<BlogPublicationStatus>(
          'draft',
          {
            nonNullable: true,
          },
        ),
      titleDe:
        new FormControl('', {
          nonNullable: true,
          validators: [
            Validators.required,
          ],
        }),
      excerptDe:
        new FormControl('', {
          nonNullable: true,
        }),
      contentDe:
        new FormControl('', {
          nonNullable: true,
        }),
      titleEn:
        new FormControl('', {
          nonNullable: true,
        }),
      excerptEn:
        new FormControl('', {
          nonNullable: true,
        }),
      contentEn:
        new FormControl('', {
          nonNullable: true,
        }),
    });

  async ngOnInit(): Promise<void> {
    try {
      const result =
        await firstValueFrom(
          forkJoin({
            images:
              this.assets.getAll(
                'image',
              ),
            authors:
              this.blog.getAuthors(),
            post: this.postId
              ? this.blog.getPost(
                  this.postId,
                )
              : Promise.resolve(
                  null,
                ),
          }),
        );

      this.images.set(
        result.images,
      );
      this.authors.set(
        result.authors,
      );

      if (result.post) {
        this.patchForm(
          result.post,
        );
        this.configureAccess(
          result.post,
        );
      } else {
        this.configureNewPost();
      }
    } catch {
      this.errorKey.set(
        'admin.blog.editor.loadFailed',
      );
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
    if (
      this.readOnly() ||
      this.form.invalid ||
      this.saving()
    ) {
      this.form.markAllAsTouched();

      return;
    }

    const input =
      this.createInput();

    if (!input) {
      return;
    }

    this.saving.set(true);
    this.saved.set(false);
    this.errorKey.set(null);

    try {
      const post =
        await firstValueFrom(
          this.postId
            ? this.blog.updatePost(
                this.postId,
                input,
              )
            : this.blog.createPost(
                input,
              ),
        );

      this.saved.set(true);

      if (!this.postId) {
        await this.router.navigate([
          '/admin/blog/posts',
          post.id,
        ]);
      }
    } catch {
      this.errorKey.set(
        'admin.blog.editor.saveFailed',
      );
    } finally {
      this.saving.set(false);
    }
  }

  private configureNewPost():
    void {
    const user = this.user();

    if (!user) {
      return;
    }

    if (user.role === 'author') {
      const author =
        this.authors().find(
          (candidate) =>
            candidate.userId ===
            user.uuid,
        );

      if (!author) {
        this.errorKey.set(
          'admin.blog.authorProfileRequired',
        );
        this.readOnly.set(true);
        this.form.disable();

        return;
      }

      this.form.controls.authorId
        .setValue(user.uuid);
      this.form.controls.authorId
        .disable();
      this.form.controls.status
        .setValue('draft');
      this.form.controls.status
        .disable();

      return;
    }

    if (
      this.authors().length === 0
    ) {
      this.errorKey.set(
        'admin.blog.editor.noAuthors',
      );

      return;
    }

    if (
      this.authors().length === 1
    ) {
      this.form.controls.authorId
        .setValue(
          this.authors()[0].userId,
        );
    }
  }

  private configureAccess(
    post: BlogAdminPost,
  ): void {
    const user = this.user();

    if (!user) {
      return;
    }

    if (user.role === 'author') {
      this.form.controls.authorId
        .disable();
      this.form.controls.status
        .disable();

      if (
        post.status ===
        'published'
      ) {
        this.readOnly.set(true);
        this.form.disable();
      }
    }
  }

  private createInput():
    SaveBlogAdminPost | null {
    const value =
      this.form.getRawValue();
    const englishTitle =
      value.titleEn.trim();
    const englishExcerpt =
      value.excerptEn.trim();
    const englishContent =
      value.contentEn.trim();

    if (
      (
        englishExcerpt ||
        englishContent
      ) &&
      !englishTitle
    ) {
      this.errorKey.set(
        'admin.blog.editor.englishTitleRequired',
      );

      return null;
    }

    return {
      slug: value.slug.trim(),
      authorId:
        value.authorId,
      coverAssetId:
        value.coverAssetId ||
        null,
      status: value.status,
      translations: {
        de: {
          title:
            value.titleDe.trim(),
          excerpt:
            value.excerptDe.trim(),
          contentMarkdown:
            value.contentDe,
        },
        en:
          englishTitle ||
          englishExcerpt ||
          englishContent
            ? {
                title:
                  englishTitle,
                excerpt:
                  englishExcerpt,
                contentMarkdown:
                  value.contentEn,
              }
            : null,
      },
    };
  }

  private patchForm(
    post: BlogAdminPost,
  ): void {
    this.form.setValue({
      slug: post.slug,
      authorId:
        post.authorId,
      coverAssetId:
        post.coverAssetId ?? '',
      status: post.status,
      titleDe:
        post.translations.de.title,
      excerptDe:
        post.translations.de.excerpt,
      contentDe:
        post.translations.de
          .contentMarkdown,
      titleEn:
        post.translations.en
          ?.title ?? '',
      excerptEn:
        post.translations.en
          ?.excerpt ?? '',
      contentEn:
        post.translations.en
          ?.contentMarkdown ?? '',
    });
  }
}
