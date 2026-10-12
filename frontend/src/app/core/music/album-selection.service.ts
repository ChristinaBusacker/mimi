import { Injectable } from '@angular/core';

/** Remembers the carousel selection across SPA navigation to and from a booklet. */
@Injectable({ providedIn: 'root' })
export class AlbumSelectionService {
  selectedSlug: string | null = null;
}
