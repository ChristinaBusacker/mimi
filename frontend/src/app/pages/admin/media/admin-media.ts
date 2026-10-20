import type { AssetType } from '@shared/assets/asset';

import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, signal } from '@angular/core';

import { AssetLibrary } from '../../../components/asset-library/asset-library';
import { I18nPipe } from '../../../core/i18n/i18n.pipe';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AsyncPipe, AssetLibrary, I18nPipe],
  selector: 'app-admin-media',
  styleUrl: './admin-media.scss',
  templateUrl: './admin-media.html',
})
export class AdminMedia {
  protected readonly type = signal<AssetType>('image');
  protected setType(type: AssetType): void {
    this.type.set(type);
  }
}
