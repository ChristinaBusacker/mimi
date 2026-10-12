import { DOCUMENT } from '@angular/common';
import { DestroyRef, ErrorHandler, Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';

import { AlbumSelectionService } from '../music/album-selection.service';

// Keep in sync with --booklet-world-size in frontend/src/styles.scss.
export const ALBUM_WORLD_OVERSCAN = 1.7;

interface ArtworkBounds {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

/** A camera move: the selected artwork, not the destination page, fills the viewport. */
export function albumDiveTransform(
  bounds: ArtworkBounds,
  viewportWidth: number,
  viewportHeight: number,
): { x: number; y: number; scale: number } {
  const x = viewportWidth / 2 - (bounds.left + bounds.width / 2);
  const y = viewportHeight / 2 - (bounds.top + bounds.height / 2);
  const scale =
    Math.max(viewportWidth / bounds.width, viewportHeight / bounds.height) * ALBUM_WORLD_OVERSCAN;
  return { x, y, scale };
}

/**
 * Intercepts only ordinary same-tab album links, before RouterLink handles the
 * click. The real href remains intact for keyboard access, new tabs and SSR.
 * No router outlet, WebGL renderer or audio element is cloned or reparented.
 */
@Injectable({ providedIn: 'root' })
export class AlbumDiveService {
  private readonly document = inject(DOCUMENT);
  private readonly router = inject(Router);
  private readonly selectedAlbum = inject(AlbumSelectionService);
  private readonly errors = inject(ErrorHandler);
  private readonly destroyRef = inject(DestroyRef);
  private listening = false;
  private busy = false;

  listen(): void {
    if (this.listening) return;
    this.listening = true;
    this.document.addEventListener('click', this.onClick, true);
    this.destroyRef.onDestroy(() => {
      this.document.removeEventListener('click', this.onClick, true);
      this.listening = false;
    });
  }

  private readonly onClick = (event: MouseEvent): void => {
    if (
      this.busy || event.defaultPrevented || event.button !== 0 ||
      event.ctrlKey || event.metaKey || event.shiftKey || event.altKey
    ) return;

    const target = event.target;
    const anchor = target instanceof Element ? target.closest('a[href]') : null;
    if (!(anchor instanceof HTMLAnchorElement) || anchor.hasAttribute('download')) return;
    if (anchor.target && anchor.target !== '_self') return;

    const destination = new URL(anchor.href, window.location.href);
    const match = /^\/music\/albums\/([^/]+)\/?$/.exec(destination.pathname);
    if (destination.origin !== window.location.origin || !match) return;
    if (window.location.pathname.startsWith('/music/albums/')) return;

    // Selecting the album is independent of whether the dive can be animated.
    const slug = decodeURIComponent(match[1]);
    this.selectedAlbum.selectedSlug = slug;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const cover = this.findArtwork(anchor);
    if (!cover || !cover.complete || cover.naturalWidth === 0) return;
    const bounds = cover.getBoundingClientRect();
    if (bounds.width < 12 || bounds.height < 12) return;

    // Stop RouterLink and the former shared-element setup from navigating
    // before the camera has reached the artwork.
    event.preventDefault();
    event.stopImmediatePropagation();
    void this.dive(destination.pathname + destination.search + destination.hash, cover, bounds);
  };

  private findArtwork(anchor: HTMLAnchorElement): HTMLImageElement | null {
    const stage = anchor.closest('.album-fan');
    if (stage) return stage.querySelector<HTMLImageElement>('.album-fan__card.is-active img');

    const release = anchor.closest('.release');
    if (release) return release.querySelector<HTMLImageElement>('.cover img');

    // The featured-album link in the homepage stage contains its own thumbnail.
    return anchor.querySelector<HTMLImageElement>('img');
  }

  private async dive(url: string, source: HTMLImageElement, bounds: DOMRect): Promise<void> {
    this.busy = true;
    const overlay = this.document.createElement('div');
    overlay.className = 'booklet-dive';
    overlay.setAttribute('aria-hidden', 'true');

    const shade = this.document.createElement('div');
    shade.className = 'booklet-dive__shade';
    const artwork = this.document.createElement('img');
    artwork.className = 'booklet-dive__artwork';
    artwork.alt = '';
    artwork.draggable = false;
    artwork.src = source.currentSrc || source.src;
    artwork.style.left = `${bounds.left}px`;
    artwork.style.top = `${bounds.top}px`;
    artwork.style.width = `${bounds.width}px`;
    artwork.style.height = `${bounds.height}px`;

    // This is the very same image treatment as the permanent booklet backdrop.
    // It takes over only once the moving artwork has escaped the viewport.
    const world = this.document.createElement('div');
    world.className = 'booklet-world booklet-dive__world';
    const worldArtwork = this.document.createElement('img');
    worldArtwork.className = 'booklet-world__artwork';
    worldArtwork.alt = '';
    worldArtwork.draggable = false;
    worldArtwork.src = artwork.src;
    world.append(worldArtwork);
    overlay.append(shade, artwork, world);

    // Homepage previews are thumbnails. Upgrade the atmospheric image in the
    // background without delaying the initial camera movement.
    const fullAsset = new URL(artwork.src, window.location.href);
    if (
      fullAsset.origin === window.location.origin &&
      fullAsset.pathname.endsWith('/image/thumbnail/webp')
    ) {
      fullAsset.pathname = fullAsset.pathname.slice(0, -'/image/thumbnail/webp'.length);
      const preload = new Image();
      preload.src = fullAsset.href;
      void preload.decode().then(
        () => { worldArtwork.src = preload.src; },
        () => { /* Keep the already loaded preview if upgrading fails. */ },
      );
    }
    this.document.body.append(overlay);

    let navigationStarted = false;
    try {
      const move = albumDiveTransform(bounds, window.innerWidth, window.innerHeight);
      const duration = 1160;
      const zoom = artwork.animate(
        [
          {
            offset: 0,
            transform: 'translate3d(0, 0, 0) scale(1)',
            filter: 'blur(0px) saturate(1) brightness(1)',
          },
          {
            offset: 0.15,
            transform: 'translate3d(0, -7px, 0) scale(1.08)',
            filter: 'blur(0px) saturate(1.04) brightness(1.03)',
          },
          {
            offset: 0.55,
            filter: 'blur(0.3px) saturate(1.04) brightness(1)',
          },
          {
            offset: 0.8,
            filter: 'blur(2px) saturate(0.97) brightness(0.88)',
          },
          {
            offset: 1,
            transform: `translate3d(${move.x}px, ${move.y}px, 0) scale(${move.scale})`,
            filter: 'blur(5px) saturate(0.91) brightness(0.72)',
          },
        ],
        { duration, easing: 'cubic-bezier(0.25, 0.66, 0.22, 1)', fill: 'forwards' },
      );
      const atmosphere = world.animate(
        [
          { offset: 0, opacity: 0 },
          { offset: 0.63, opacity: 0 },
          { offset: 0.83, opacity: 0.6 },
          { offset: 1, opacity: 1 },
        ],
        { duration, easing: 'linear', fill: 'forwards' },
      );
      shade.animate([{ opacity: 0 }, { opacity: 0.9 }], {
        duration: 660,
        easing: 'ease-out',
        fill: 'forwards',
      });

      // There is no page reveal here. Angular navigates behind an artwork
      // which has already expanded beyond every edge of the visible screen.
      await Promise.all([zoom.finished, atmosphere.finished]);
      navigationStarted = true;
      const navigated = await this.router.navigateByUrl(url);
      if (!navigated) return;

      // Identical backdrop image, crop and filters on both sides of the route:
      // the final fade reveals content, not a different background.
      await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
      await overlay.animate([{ opacity: 1 }, { opacity: 0 }], {
        duration: 490,
        easing: 'cubic-bezier(0.35, 0, 0.3, 1)',
        fill: 'forwards',
      }).finished;
    } catch (error) {
      this.errors.handleError(error);
      if (!navigationStarted) {
        try {
          await this.router.navigateByUrl(url);
        } catch (navigationError) {
          this.errors.handleError(navigationError);
        }
      }
    } finally {
      overlay.remove();
      this.busy = false;
    }
  }
}
