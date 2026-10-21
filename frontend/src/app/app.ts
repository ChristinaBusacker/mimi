import { Component, ViewContainerRef, afterNextRender, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map, startWith } from 'rxjs';

import { Background } from './components/background/background';
import { BookletNavigation } from './components/booklet-navigation/booklet-navigation';
import { ConsentBanner } from './components/consent-banner/consent-banner';
import { Footer } from './components/footer/footer';
import { GlobalMusicPlayer } from './components/global-music-player/global-music-player';
import { Header } from './components/header/header';
import { Lightbox } from './components/lightbox/lightbox';
import { PwaUpdateBanner } from './components/pwa-update-banner/pwa-update-banner';
import { isBookletRoute } from './core/navigation/booklet-transition';
import { AlbumDiveService } from './core/navigation/album-dive.service';

@Component({
  imports: [
    RouterOutlet,
    Background,
    BookletNavigation,
    ConsentBanner,
    Footer,
    GlobalMusicPlayer,
    Header,
    Lightbox,
    PwaUpdateBanner,
  ],
  host: { '[class.is-booklet]': 'bookletMode()' },
  selector: 'app-root',
  styleUrl: './app.scss',
  templateUrl: './app.html',
})
export class App {
  private readonly router = inject(Router);
  private readonly albumDive = inject(AlbumDiveService);

  constructor(public vcRef: ViewContainerRef) {
    // Capture only album-entry links, without changing the site's other navigation.
    afterNextRender(() => this.albumDive.listen());
  }

  protected readonly adminMode = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects === '/admin' || event.urlAfterRedirects.startsWith('/admin/')),
      startWith(this.router.url === '/admin' || this.router.url.startsWith('/admin/')),
    ),
    { initialValue: this.router.url === '/admin' || this.router.url.startsWith('/admin/') },
  );

  protected readonly bookletMode = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map(() => isBookletRoute(this.router.routerState.snapshot.root)),
      startWith(isBookletRoute(this.router.routerState.snapshot.root)),
    ),
    { initialValue: false },
  );
}
