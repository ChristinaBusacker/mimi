import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject } from '@angular/core';

/** Remembers the carousel selection across SPA navigation to and from a booklet. */
@Injectable({ providedIn: 'root' })
export class AlbumSelectionService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly storageKey = 'mimi.music.selectedAlbumSlug';
  private currentSlug: string | null = null;

  get selectedSlug(): string | null {
    if (this.currentSlug) return this.currentSlug;
    if (!this.isBrowser) return null;
    try { return sessionStorage.getItem(this.storageKey); } catch { return null; }
  }

  set selectedSlug(slug: string | null) {
    this.currentSlug = slug;
    if (!this.isBrowser) return;
    try {
      if (slug) sessionStorage.setItem(this.storageKey, slug);
      else sessionStorage.removeItem(this.storageKey);
    } catch { /* Storage may be unavailable in private sessions. */ }
  }
}
