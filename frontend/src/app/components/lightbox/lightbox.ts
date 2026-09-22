import { AsyncPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  inject,
} from '@angular/core';

import { I18nPipe } from '../../core/i18n/i18n.pipe';
import { LightboxService } from './lightbox.service';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AsyncPipe, I18nPipe],
  selector: 'app-lightbox',
  styleUrl: './lightbox.scss',
  templateUrl: './lightbox.html',
})
export class Lightbox {
  private readonly lightbox =
    inject(LightboxService);

  protected readonly current =
    this.lightbox.current;
  protected readonly count =
    this.lightbox.count;
  protected readonly index =
    this.lightbox.index;
  protected readonly hasMultiple =
    this.lightbox.hasMultiple;

  protected close(): void {
    this.lightbox.close();
  }

  protected closeFromBackdrop(
    event: MouseEvent,
  ): void {
    if (event.target === event.currentTarget) {
      this.close();
    }
  }

  protected next(): void {
    this.lightbox.next();
  }

  protected previous(): void {
    this.lightbox.previous();
  }

  @HostListener('document:keydown', ['$event'])
  protected handleKeydown(
    event: KeyboardEvent,
  ): void {
    if (!this.current()) {
      return;
    }

    if (event.key === 'Escape') {
      this.close();
      return;
    }

    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      this.previous();
      return;
    }

    if (event.key === 'ArrowRight') {
      event.preventDefault();
      this.next();
    }
  }
}
