import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { Background } from './components/background/background';
import { ConsentBanner } from './components/consent-banner/consent-banner';
import { Footer } from './components/footer/footer';
import { GlobalMusicPlayer } from './components/global-music-player/global-music-player';
import { Header } from './components/header/header';
import { Lightbox } from './components/lightbox/lightbox';
import { PwaUpdateBanner } from './components/pwa-update-banner/pwa-update-banner';

@Component({
  imports: [RouterOutlet, Background, ConsentBanner, Footer, GlobalMusicPlayer, Header, Lightbox, PwaUpdateBanner],
  selector: 'app-root',
  styleUrl: './app.scss',
  templateUrl: './app.html',
})
export class App {
  protected readonly title = signal('frontend');
}
