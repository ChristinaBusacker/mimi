import type { Asset } from '@shared/assets/asset';
import type {
  ContentMediaAlignment,
  ContentMediaSize,
} from '@shared/content/content-media';

import {
  AsyncPipe,
  isPlatformBrowser,
} from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  PLATFORM_ID,
  ViewEncapsulation,
  computed,
  forwardRef,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import {
  ControlValueAccessor,
  NG_VALUE_ACCESSOR,
} from '@angular/forms';
import { Editor } from '@tiptap/core';
import { Markdown } from '@tiptap/markdown';
import { NodeSelection } from '@tiptap/pm/state';
import StarterKit from '@tiptap/starter-kit';

import { I18nPipe } from '../../core/i18n/i18n.pipe';
import { AssetLibrary } from '../asset-library/asset-library';
import { Icon } from '../icon/icon';
import { AssetImage } from './asset-image.extension';
import {
  MarkdownStrike,
  MarkdownUnderline,
} from './text-decoration-marks.extension';
import { YoutubeEmbed } from './youtube-embed.extension';

type EditorDialog =
  | 'link'
  | 'image'
  | 'youtube';

type EditableMedia =
  | 'image'
  | 'youtube';

type EditorBlockType =
  | 'paragraph'
  | 'heading2'
  | 'heading3';

interface StoredSelection {
  kind: 'text' | 'node';
  from: number;
  to: number;
}

const YOUTUBE_ID_PATTERN =
  /^[A-Za-z0-9_-]{6,20}$/;

@Component({
  changeDetection:
    ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [
    AssetLibrary,
    AsyncPipe,
    I18nPipe,
    Icon,
  ],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting:
        forwardRef(
          () => MarkdownEditor,
        ),
      multi: true,
    },
  ],
  selector: 'app-markdown-editor',
  styleUrl: './markdown-editor.scss',
  templateUrl: './markdown-editor.html',
})
export class MarkdownEditor
  implements
    AfterViewInit,
    OnDestroy,
    ControlValueAccessor
{
  private readonly platformId =
    inject(PLATFORM_ID);
  private readonly editorHost =
    viewChild<
      ElementRef<HTMLElement>
    >('editorHost');
  private readonly settingsDialog =
    viewChild<
      ElementRef<HTMLDialogElement>
    >('settingsDialog');
  private readonly imageLibrary =
    viewChild(AssetLibrary);

  readonly label =
    input<string | null>('');
  readonly assets =
    input<readonly Asset[]>([]);
  readonly assetUploaded =
    output<Asset>();
  readonly assetDeleted =
    output<string>();

  private readonly editor =
    signal<Editor | null>(null);
  private readonly revision =
    signal(0);
  private readonly disabled =
    signal(false);

  protected readonly dialogType =
    signal<EditorDialog | null>(
      null,
    );
  protected readonly editingMedia =
    signal<EditableMedia | null>(
      null,
    );
  protected readonly editingLink =
    signal(false);
  protected readonly linkUrl =
    signal('');
  protected readonly imageAssetId =
    signal('');
  protected readonly imageAlt =
    signal('');
  protected readonly imageAlignment =
    signal<ContentMediaAlignment>(
      'center',
    );
  protected readonly imageSize =
    signal<ContentMediaSize>(
      'large',
    );
  protected readonly youtubeValue =
    signal('');
  protected readonly youtubeAlignment =
    signal<ContentMediaAlignment>(
      'center',
    );
  protected readonly youtubeSize =
    signal<ContentMediaSize>(
      'large',
    );
  protected readonly errorKey =
    signal<string | null>(null);

  protected readonly availableAssets =
    computed(() =>
      this.assets().filter(
        (asset) =>
          asset.type === 'image',
      ),
    );

  protected readonly selectedImage =
    computed(
      () =>
        this.availableAssets().find(
          (asset) =>
            asset.id ===
            this.imageAssetId(),
        ) ?? null,
    );

  private value = '';
  private storedSelection:
    StoredSelection | null = null;
  private onChange:
    (value: string) => void =
      () => undefined;
  private onTouched:
    () => void =
      () => undefined;

  ngAfterViewInit(): void {
    if (
      !isPlatformBrowser(
        this.platformId,
      )
    ) {
      return;
    }

    const element =
      this.editorHost()
        ?.nativeElement;

    if (!element) {
      return;
    }

    const editor = new Editor({
      element,
      extensions: [
        StarterKit.configure({
          code: false,
          codeBlock: false,
          heading: {
            levels: [2, 3],
          },
          horizontalRule: false,
          strike: false,
          underline: false,
          link: {
            openOnClick: false,
          },
        }),
        MarkdownUnderline,
        MarkdownStrike,
        AssetImage,
        YoutubeEmbed,
        Markdown.configure({
          markedOptions: {
            breaks: false,
            gfm: false,
          },
        }),
      ],
      content: this.value,
      contentType: 'markdown',
      editable: !this.disabled(),
      editorProps: {
        attributes: {
          class:
            'markdown-editor__content',
          role: 'textbox',
          'aria-multiline': 'true',
          'aria-label':
            this.label() ??
            'Markdown',
        },
      },
      onUpdate: ({
        editor: currentEditor,
      }) => {
        this.value =
          currentEditor.getMarkdown();
        this.onChange(this.value);
        this.bumpRevision();
      },
      onSelectionUpdate: () => {
        this.bumpRevision();
      },
      onBlur: () => {
        this.onTouched();
      },
    });

    this.editor.set(editor);
  }

  ngOnDestroy(): void {
    this.editor()?.destroy();
  }

  writeValue(
    value: string | null,
  ): void {
    this.value = value ?? '';

    const editor =
      this.editor();

    if (
      editor &&
      editor.getMarkdown() !==
        this.value
    ) {
      editor.commands.setContent(
        this.value,
        {
          contentType: 'markdown',
          emitUpdate: false,
        },
      );
    }
  }

  registerOnChange(
    callback:
      (value: string) => void,
  ): void {
    this.onChange = callback;
  }

  registerOnTouched(
    callback: () => void,
  ): void {
    this.onTouched = callback;
  }

  setDisabledState(
    disabled: boolean,
  ): void {
    this.disabled.set(disabled);
    this.editor()?.setEditable(
      !disabled,
    );
  }

  protected isDisabled(): boolean {
    return this.disabled();
  }

  protected blockType():
    EditorBlockType {
    this.revision();

    if (
      this.editor()?.isActive(
        'heading',
        {
          level: 2,
        },
      )
    ) {
      return 'heading2';
    }

    if (
      this.editor()?.isActive(
        'heading',
        {
          level: 3,
        },
      )
    ) {
      return 'heading3';
    }

    return 'paragraph';
  }

  protected setBlockType(
    event: Event,
  ): void {
    const value =
      this.readControlValue(
        event,
      );
    const editor =
      this.editor();

    if (!editor) {
      return;
    }

    if (value === 'heading2') {
      editor
        .chain()
        .focus()
        .setHeading({
          level: 2,
        })
        .run();

      return;
    }

    if (value === 'heading3') {
      editor
        .chain()
        .focus()
        .setHeading({
          level: 3,
        })
        .run();

      return;
    }

    editor
      .chain()
      .focus()
      .setParagraph()
      .run();
  }

  protected isBoldActive(): boolean {
    this.revision();

    return (
      this.editor()?.isActive(
        'bold',
      ) ?? false
    );
  }

  protected isItalicActive(): boolean {
    this.revision();

    return (
      this.editor()?.isActive(
        'italic',
      ) ?? false
    );
  }

  protected isUnderlineActive():
    boolean {
    this.revision();

    return (
      this.editor()?.isActive(
        'underline',
      ) ?? false
    );
  }

  protected isStrikeActive(): boolean {
    this.revision();

    return (
      this.editor()?.isActive(
        'strike',
      ) ?? false
    );
  }

  protected isLinkActive(): boolean {
    this.revision();

    return (
      this.editor()?.isActive(
        'link',
      ) ?? false
    );
  }

  protected isBulletListActive():
    boolean {
    this.revision();

    return (
      this.editor()?.isActive(
        'bulletList',
      ) ?? false
    );
  }

  protected isOrderedListActive():
    boolean {
    this.revision();

    return (
      this.editor()?.isActive(
        'orderedList',
      ) ?? false
    );
  }

  protected isBlockquoteActive():
    boolean {
    this.revision();

    return (
      this.editor()?.isActive(
        'blockquote',
      ) ?? false
    );
  }

  protected isImageSelected():
    boolean {
    this.revision();

    return (
      this.selectedNodeAttributes(
        this.editor(),
        'assetImage',
      ) !== null
    );
  }

  protected isYoutubeSelected():
    boolean {
    this.revision();

    return (
      this.selectedNodeAttributes(
        this.editor(),
        'youtubeEmbed',
      ) !== null
    );
  }

  protected toggleBold(): void {
    this.editor()
      ?.chain()
      .focus()
      .toggleBold()
      .run();
  }

  protected toggleItalic(): void {
    this.editor()
      ?.chain()
      .focus()
      .toggleItalic()
      .run();
  }

  protected toggleUnderline(): void {
    this.editor()
      ?.chain()
      .focus()
      .toggleMark('underline')
      .run();
  }

  protected toggleStrike(): void {
    this.editor()
      ?.chain()
      .focus()
      .toggleMark('strike')
      .run();
  }

  protected toggleBulletList():
    void {
    this.editor()
      ?.chain()
      .focus()
      .toggleBulletList()
      .run();
  }

  protected toggleOrderedList():
    void {
    this.editor()
      ?.chain()
      .focus()
      .toggleOrderedList()
      .run();
  }

  protected toggleBlockquote():
    void {
    this.editor()
      ?.chain()
      .focus()
      .toggleBlockquote()
      .run();
  }

  protected undo(): void {
    this.editor()
      ?.chain()
      .focus()
      .undo()
      .run();
  }

  protected redo(): void {
    this.editor()
      ?.chain()
      .focus()
      .redo()
      .run();
  }

  protected openDialog(
    dialog:
      EditorDialog,
  ): void {
    const editor =
      this.editor();

    if (
      !editor ||
      this.disabled()
    ) {
      return;
    }

    this.rememberSelection(
      editor,
    );
    this.errorKey.set(null);
    this.editingMedia.set(null);
    this.editingLink.set(false);

    if (dialog === 'link') {
      this.loadSelectedLink(
        editor,
      );
    } else if (
      dialog === 'image'
    ) {
      if (
        !this.loadSelectedImage()
      ) {
        this.resetImageForm();
      }
    } else if (
      !this.loadSelectedYoutube()
    ) {
      this.resetYoutubeForm();
    }

    this.dialogType.set(dialog);

    queueMicrotask(() => {
      const element =
        this.settingsDialog()
          ?.nativeElement;

      if (
        element &&
        !element.open
      ) {
        element.showModal();
      }
    });
  }

  protected closeDialog(): void {
    this.settingsDialog()
      ?.nativeElement
      .close();
  }

  protected onDialogClosed():
    void {
    const dialog =
      this.dialogType();

    if (dialog === 'image') {
      this.resetImageForm();
    } else if (
      dialog === 'youtube'
    ) {
      this.resetYoutubeForm();
    } else {
      this.linkUrl.set('');
    }

    this.dialogType.set(null);
    this.editingMedia.set(null);
    this.editingLink.set(false);
    this.errorKey.set(null);
    this.storedSelection = null;
  }

  protected setLinkUrl(
    event: Event,
  ): void {
    this.linkUrl.set(
      this.readControlValue(
        event,
      ),
    );
  }

  protected applyLink(): void {
    const href =
      this.normalizeLink(
        this.linkUrl(),
      );
    const editor =
      this.editor();

    if (!href) {
      this.errorKey.set(
        'admin.markdown.invalidLink',
      );

      return;
    }

    if (!editor) {
      return;
    }

    this.restoreSelection(
      editor,
    );

    const chain =
      editor
        .chain()
        .focus();

    if (this.editingLink()) {
      chain.extendMarkRange(
        'link',
      );
    }

    chain
      .setLink({
        href,
      })
      .run();

    this.closeDialog();
  }

  protected removeLink(): void {
    const editor =
      this.editor();

    if (!editor) {
      return;
    }

    this.restoreSelection(
      editor,
    );

    editor
      .chain()
      .focus()
      .extendMarkRange('link')
      .unsetLink()
      .run();

    this.closeDialog();
  }

  protected openImageLibrary():
    void {
    void this.imageLibrary()
      ?.open();
  }

  protected selectImageAsset(
    asset: Asset,
  ): void {
    this.imageAssetId.set(
      asset.id,
    );
    this.errorKey.set(null);
  }

  protected addImageAsset(
    asset: Asset,
  ): void {
    this.imageAssetId.set(
      asset.id,
    );
    this.assetUploaded.emit(
      asset,
    );
  }

  protected removeImageAsset(
    assetId: string,
  ): void {
    if (
      this.imageAssetId() ===
      assetId
    ) {
      this.imageAssetId.set('');
    }

    this.assetDeleted.emit(
      assetId,
    );
  }

  protected setImageAlt(
    event: Event,
  ): void {
    this.imageAlt.set(
      this.readControlValue(
        event,
      ),
    );
  }

  protected setImageAlignment(
    event: Event,
  ): void {
    this.imageAlignment.set(
      this.readMediaAlignment(
        this.readControlValue(
          event,
        ),
      ),
    );
  }

  protected setImageSize(
    event: Event,
  ): void {
    this.imageSize.set(
      this.readMediaSize(
        this.readControlValue(
          event,
        ),
      ),
    );
  }

  protected saveImage(): void {
    const assetId =
      this.imageAssetId();
    const editor =
      this.editor();

    if (!assetId) {
      this.errorKey.set(
        'admin.markdown.imageRequired',
      );

      return;
    }

    if (!editor) {
      return;
    }

    this.restoreSelection(
      editor,
    );

    const attrs = {
      assetId,
      alt:
        this.imageAlt().trim(),
      alignment:
        this.imageAlignment(),
      size: this.imageSize(),
    };

    if (
      this.editingMedia() ===
        'image' &&
      this.selectedNodeAttributes(
        editor,
        'assetImage',
      )
    ) {
      editor
        .chain()
        .focus()
        .updateAttributes(
          'assetImage',
          attrs,
        )
        .run();
    } else {
      editor
        .chain()
        .focus()
        .insertContent({
          type: 'assetImage',
          attrs,
        })
        .run();
    }

    this.closeDialog();
  }

  protected setYoutubeValue(
    event: Event,
  ): void {
    this.youtubeValue.set(
      this.readControlValue(
        event,
      ),
    );
  }

  protected setYoutubeAlignment(
    event: Event,
  ): void {
    this.youtubeAlignment.set(
      this.readMediaAlignment(
        this.readControlValue(
          event,
        ),
      ),
    );
  }

  protected setYoutubeSize(
    event: Event,
  ): void {
    this.youtubeSize.set(
      this.readMediaSize(
        this.readControlValue(
          event,
        ),
      ),
    );
  }

  protected saveYoutube(): void {
    const videoId =
      this.extractYoutubeId(
        this.youtubeValue(),
      );
    const editor =
      this.editor();

    if (!videoId) {
      this.errorKey.set(
        'admin.markdown.invalidYoutube',
      );

      return;
    }

    if (!editor) {
      return;
    }

    this.restoreSelection(
      editor,
    );

    const attrs = {
      videoId,
      alignment:
        this.youtubeAlignment(),
      size: this.youtubeSize(),
    };

    if (
      this.editingMedia() ===
        'youtube' &&
      this.selectedNodeAttributes(
        editor,
        'youtubeEmbed',
      )
    ) {
      editor
        .chain()
        .focus()
        .updateAttributes(
          'youtubeEmbed',
          attrs,
        )
        .run();
    } else {
      editor
        .chain()
        .focus()
        .insertContent([
          {
            type: 'youtubeEmbed',
            attrs,
          },
          {
            type: 'paragraph',
          },
        ])
        .run();
    }

    this.closeDialog();
  }

  protected removeSelectedMedia():
    void {
    const editor =
      this.editor();
    const editingMedia =
      this.editingMedia();

    if (
      !editor ||
      !editingMedia
    ) {
      return;
    }

    this.restoreSelection(
      editor,
    );

    const nodeName =
      editingMedia === 'image'
        ? 'assetImage'
        : 'youtubeEmbed';

    if (
      !this.selectedNodeAttributes(
        editor,
        nodeName,
      )
    ) {
      return;
    }

    editor
      .chain()
      .focus()
      .deleteSelection()
      .run();

    this.closeDialog();
  }

  private rememberSelection(
    editor: Editor,
  ): void {
    const selection =
      editor.state.selection;

    this.storedSelection = {
      kind:
        selection instanceof
        NodeSelection
          ? 'node'
          : 'text',
      from: selection.from,
      to: selection.to,
    };
  }

  private restoreSelection(
    editor: Editor,
  ): void {
    const selection =
      this.storedSelection;

    if (!selection) {
      return;
    }

    const maxPosition =
      editor.state.doc.content.size;
    const from = Math.min(
      selection.from,
      maxPosition,
    );
    const to = Math.min(
      selection.to,
      maxPosition,
    );

    if (
      selection.kind === 'node' &&
      editor.state.doc.nodeAt(
        from,
      )
    ) {
      editor.commands.setNodeSelection(
        from,
      );

      return;
    }

    editor.commands.setTextSelection({
      from,
      to: Math.max(from, to),
    });
  }

  private loadSelectedLink(
    editor: Editor,
  ): void {
    const active =
      editor.isActive('link');
    const href =
      editor.getAttributes(
        'link',
      )['href'];

    this.editingLink.set(active);
    this.linkUrl.set(
      active &&
      typeof href === 'string'
        ? href
        : '',
    );
  }

  private loadSelectedImage():
    boolean {
    const attrs =
      this.selectedNodeAttributes(
        this.editor(),
        'assetImage',
      );

    if (!attrs) {
      return false;
    }

    this.imageAssetId.set(
      this.readStringAttribute(
        attrs,
        'assetId',
      ),
    );
    this.imageAlt.set(
      this.readStringAttribute(
        attrs,
        'alt',
      ),
    );
    this.imageAlignment.set(
      this.readMediaAlignment(
        attrs['alignment'],
      ),
    );
    this.imageSize.set(
      this.readMediaSize(
        attrs['size'],
      ),
    );
    this.editingMedia.set(
      'image',
    );

    return true;
  }

  private loadSelectedYoutube():
    boolean {
    const attrs =
      this.selectedNodeAttributes(
        this.editor(),
        'youtubeEmbed',
      );

    if (!attrs) {
      return false;
    }

    this.youtubeValue.set(
      this.readStringAttribute(
        attrs,
        'videoId',
      ),
    );
    this.youtubeAlignment.set(
      this.readMediaAlignment(
        attrs['alignment'],
      ),
    );
    this.youtubeSize.set(
      this.readMediaSize(
        attrs['size'],
      ),
    );
    this.editingMedia.set(
      'youtube',
    );

    return true;
  }

  private selectedNodeAttributes(
    editor: Editor | null,
    nodeName:
      | 'assetImage'
      | 'youtubeEmbed',
  ): Record<
    string,
    unknown
  > | null {
    if (!editor) {
      return null;
    }

    const selection =
      editor.state.selection;

    if (
      !(
        selection instanceof
        NodeSelection
      ) ||
      selection.node.type.name !==
        nodeName
    ) {
      return null;
    }

    return selection.node.attrs as Record<
      string,
      unknown
    >;
  }

  private readStringAttribute(
    attrs: Record<
      string,
      unknown
    >,
    name: string,
  ): string {
    const value =
      attrs[name];

    return typeof value ===
      'string'
      ? value
      : '';
  }

  private readMediaAlignment(
    value: unknown,
  ): ContentMediaAlignment {
    return value === 'left' ||
      value === 'right' ||
      value === 'center'
      ? value
      : 'center';
  }

  private readMediaSize(
    value: unknown,
  ): ContentMediaSize {
    return value === 'small' ||
      value === 'medium' ||
      value === 'large' ||
      value === 'full'
      ? value
      : 'large';
  }

  private resetImageForm(): void {
    this.imageAssetId.set('');
    this.imageAlt.set('');
    this.imageAlignment.set(
      'center',
    );
    this.imageSize.set(
      'large',
    );
  }

  private resetYoutubeForm():
    void {
    this.youtubeValue.set('');
    this.youtubeAlignment.set(
      'center',
    );
    this.youtubeSize.set(
      'large',
    );
  }

  private bumpRevision(): void {
    this.revision.update(
      (revision) =>
        revision + 1,
    );
  }

  private readControlValue(
    event: Event,
  ): string {
    const target =
      event.target;

    return target instanceof
      HTMLInputElement ||
      target instanceof
        HTMLSelectElement
      ? target.value
      : '';
  }

  private normalizeLink(
    value: string,
  ): string | null {
    const trimmed =
      value.trim();

    if (
      trimmed.startsWith(
        'mailto:',
      )
    ) {
      return trimmed.includes('@')
        ? trimmed
        : null;
    }

    try {
      const url =
        new URL(trimmed);

      return url.protocol ===
        'http:' ||
        url.protocol ===
          'https:'
        ? url.toString()
        : null;
    } catch {
      return null;
    }
  }

  private extractYoutubeId(
    value: string,
  ): string | null {
    const trimmed =
      value.trim();

    if (
      YOUTUBE_ID_PATTERN.test(
        trimmed,
      )
    ) {
      return trimmed;
    }

    try {
      const url =
        new URL(trimmed);
      const host =
        url.hostname
          .toLowerCase()
          .replace(/^www\./, '');

      if (
        host === 'youtu.be'
      ) {
        return this.validateYoutubeId(
          url.pathname
            .split('/')
            .filter(Boolean)[0],
        );
      }

      if (
        host !==
          'youtube.com' &&
        host !==
          'm.youtube.com' &&
        host !==
          'music.youtube.com'
      ) {
        return null;
      }

      if (
        url.pathname ===
        '/watch'
      ) {
        return this.validateYoutubeId(
          url.searchParams.get(
            'v',
          ),
        );
      }

      const [
        kind,
        videoId,
      ] =
        url.pathname
          .split('/')
          .filter(Boolean);

      if (
        kind === 'embed' ||
        kind === 'shorts' ||
        kind === 'live'
      ) {
        return this.validateYoutubeId(
          videoId,
        );
      }

      return null;
    } catch {
      return null;
    }
  }

  private validateYoutubeId(
    value:
      | string
      | null
      | undefined,
  ): string | null {
    return value &&
      YOUTUBE_ID_PATTERN.test(
        value,
      )
      ? value
      : null;
  }
}
