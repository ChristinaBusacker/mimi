import { Routes } from '@angular/router';

import { homeDataResolver } from './pages/home/home.resolver';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/home/home').then((module) => module.Home),
    resolve: {
      data: homeDataResolver,
    },
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
