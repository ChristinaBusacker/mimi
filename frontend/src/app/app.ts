import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { Background } from './components/background/background';
import { Footer } from './components/footer/footer';
import { Header } from './components/header/header';
import { Lightbox } from './components/lightbox/lightbox';

@Component({
  imports: [
    RouterOutlet,
    Background,
    Footer,
    Header,
    Lightbox,
  ],
  selector: 'app-root',
  styleUrl: './app.scss',
  templateUrl: './app.html',
})
export class App {
  protected readonly title = signal('frontend');
}
