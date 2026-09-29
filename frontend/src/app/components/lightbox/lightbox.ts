import { AsyncPipe, DOCUMENT, isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  PLATFORM_ID,
  effect,
  inject,
  viewChild,
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
  private readonly document = inject(DOCUMENT);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly lightbox = inject(LightboxService);
  private readonly dialog = viewChild<ElementRef<HTMLElement>>('dialog');

  private restoreFocusTo: HTMLElement | null = null;

  protected readonly items = this.lightbox.items;
  protected readonly current = this.lightbox.current;
  protected readonly count = this.lightbox.count;
  protected readonly index = this.lightbox.index;
  protected readonly hasMultiple = this.lightbox.hasMultiple;

  constructor() {
    effect(() => {
      const isOpen = this.current() !== null;

      if (!this.isBrowser) {
        return;
      }

      if (isOpen) {
        if (!this.restoreFocusTo && this.document.activeElement instanceof HTMLElement) {
          this.restoreFocusTo = this.document.activeElement;
        }

        queueMicrotask(() => {
          this.dialog()?.nativeElement.focus();
        });

        return;
      }

      const restoreFocusTo = this.restoreFocusTo;
      this.restoreFocusTo = null;

      if (restoreFocusTo) {
        queueMicrotask(() => {
          if (restoreFocusTo.isConnected) {
            restoreFocusTo.focus();
          }
        });
      }
    });
  }

  protected close(): void {
    this.lightbox.close();
  }

  protected closeFromBackdrop(event: MouseEvent): void {
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

  protected select(index: number): void {
    this.lightbox.select(index);
  }

  @HostListener('document:keydown', ['$event'])
  protected handleKeydown(event: KeyboardEvent): void {
    if (!this.current()) {
      return;
    }

    if (event.key === 'Escape') {
      this.close();
      return;
    }

    if (event.key === 'Tab') {
      this.trapFocus(event);
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

  private trapFocus(event: KeyboardEvent): void {
    const dialog = this.dialog()?.nativeElement;

    if (!dialog) {
      return;
    }

    const focusableElements = Array.from(
      dialog.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((element) => element.offsetParent !== null);

    if (focusableElements.length === 0) {
      event.preventDefault();
      dialog.focus();
      return;
    }

    const first = focusableElements[0];
    const last = focusableElements[focusableElements.length - 1];
    const activeElement = this.document.activeElement;

    if (event.shiftKey && (activeElement === first || activeElement === dialog)) {
      event.preventDefault();
      last.focus();
      return;
    }

    if (!event.shiftKey && activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
}
