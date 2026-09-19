import { Home } from './pages/home/home';
import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/home/home').then((module) => module.Home),
  },
  {
    path: 'gaming',
    loadComponent: () => import('./pages/gaming/gaming').then((module) => module.Gaming),
  },
  {
    path: 'music',
    loadComponent: () => import('./pages/music/music').then((module) => module.Music),
  },
  {
    path: 'videos',
    loadComponent: () => import('./pages/videos/videos').then((module) => module.Videos),
  },
];
