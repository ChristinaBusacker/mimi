import { AsyncPipe, DOCUMENT, isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  PLATFORM_ID,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

import { I18nPipe } from '../../core/i18n/i18n.pipe';
import { Button } from '../button/button';
import { Icon } from '../icon/icon';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AsyncPipe, Button, I18nPipe, Icon, RouterLink, RouterLinkActive],
  selector: 'app-header',
  styleUrl: './header.scss',
  templateUrl: './header.html',
})
export class Header implements OnDestroy {
  private readonly document = inject(DOCUMENT);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private readonly mobileShell = viewChild<ElementRef<HTMLElement>>('mobileShell');

  private readonly menuToggle = viewChild<ElementRef<HTMLButtonElement>>('menuToggle');

  private previousBodyOverflow = '';

  protected readonly menuOpen = signal(false);

  ngOnDestroy(): void {
    this.unlockBodyScroll();
  }

  protected toggleMenu(): void {
    if (this.menuOpen()) {
      this.closeMenu();

      return;
    }

    this.openMenu();
  }

  protected closeMenu(): void {
    if (!this.menuOpen()) {
      return;
    }

    this.menuOpen.set(false);
    this.unlockBodyScroll();
  }

  @HostListener('document:keydown', ['$event'])
  protected handleDocumentKeydown(event: KeyboardEvent): void {
    if (!this.menuOpen()) {
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      this.closeMenu();
      this.menuToggle()?.nativeElement.focus();

      return;
    }

    if (event.key === 'Tab') {
      this.trapFocus(event);
    }
  }

  @HostListener('window:resize')
  protected handleWindowResize(): void {
    if (this.isBrowser && this.menuOpen() && window.innerWidth > 900) {
      this.closeMenu();
    }
  }

  private openMenu(): void {
    this.menuOpen.set(true);
    this.lockBodyScroll();
  }

  private lockBodyScroll(): void {
    if (!this.isBrowser) {
      return;
    }

    this.previousBodyOverflow = this.document.body.style.overflow;
    this.document.body.style.overflow = 'hidden';
  }

  private unlockBodyScroll(): void {
    if (!this.isBrowser) {
      return;
    }

    this.document.body.style.overflow = this.previousBodyOverflow;
  }

  private trapFocus(event: KeyboardEvent): void {
    const shell = this.mobileShell()?.nativeElement;

    if (!shell) {
      return;
    }

    const focusableElements = Array.from(
      shell.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((element) => element.offsetParent !== null);

    if (focusableElements.length === 0) {
      return;
    }

    const first = focusableElements[0];
    const last = focusableElements[focusableElements.length - 1];
    const activeElement = this.document.activeElement;

    if (event.shiftKey && activeElement === first) {
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
