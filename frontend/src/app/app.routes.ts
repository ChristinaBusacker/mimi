import { Routes } from '@angular/router';

import { adminGuard } from './core/auth/admin.guard';
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
  {
    path: 'impressum',
    loadComponent: () =>
      import('./pages/legal-notice/legal-notice').then(
        (module) => module.LegalNotice,
      ),
  },
  {
    path: 'datenschutz',
    loadComponent: () =>
      import('./pages/privacy/privacy').then(
        (module) => module.Privacy,
      ),
  },
  {
    path: 'kontakt',
    loadComponent: () =>
      import('./pages/contact/contact').then(
        (module) => module.Contact,
      ),
  },
  {
    path: 'admin/login',
    loadComponent: () =>
      import('./pages/admin/login/admin-login').then(
        (module) => module.AdminLogin,
      ),
  },
  {
    path: 'admin',
    canActivate: [adminGuard],
    loadComponent: () =>
      import('./pages/admin/shell/admin-shell').then(
        (module) => module.AdminShell,
      ),
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./pages/admin/dashboard/admin-dashboard').then(
            (module) => module.AdminDashboard,
          ),
      },
    ],
  },
];
