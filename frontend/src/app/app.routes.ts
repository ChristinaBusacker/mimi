import { Routes } from '@angular/router';

import { adminGuard } from './core/auth/admin.guard';
import { blogAuthorResolver } from './pages/blog/author/blog-author.resolver';
import { blogDataResolver } from './pages/blog/blog.resolver';
import { blogPostResolver } from './pages/blog/post/blog-post.resolver';
import { contributorGuard } from './core/auth/contributor.guard';
import { gamingDataResolver } from './pages/gaming/gaming.resolver';
import { homeDataResolver } from './pages/home/home.resolver';
import { musicAlbumResolver } from './pages/music/album/music-album.resolver';
import { musicDataResolver } from './pages/music/music.resolver';

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
    resolve: {
      data: gamingDataResolver,
    },
  },
  {
    path: 'music',
    loadComponent: () => import('./pages/music/music').then((module) => module.Music),
    resolve: {
      data: musicDataResolver,
    },
  },
  {
    path: 'music/albums/:slug',
    loadComponent: () =>
      import('./pages/music/album/music-album').then(
        (module) => module.MusicAlbumPage,
      ),
    resolve: {
      data: musicAlbumResolver,
    },
  },
  {
    path: 'blog',
    loadComponent: () =>
      import('./pages/blog/blog').then(
        (module) => module.Blog,
      ),
    resolve: {
      data: blogDataResolver,
    },
  },
  {
    path: 'blog/autoren/:slug',
    loadComponent: () =>
      import('./pages/blog/author/blog-author').then(
        (module) =>
          module.BlogAuthorPageComponent,
      ),
    resolve: {
      data: blogAuthorResolver,
    },
  },
  {
    path: 'blog/:slug',
    loadComponent: () =>
      import('./pages/blog/post/blog-post').then(
        (module) => module.BlogPostPage,
      ),
    resolve: {
      data: blogPostResolver,
    },
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
    canActivate: [contributorGuard],
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
      {
        path: 'blog',
        loadComponent: () =>
          import('./pages/admin/blog/admin-blog').then(
            (module) => module.AdminBlog,
          ),
      },
      {
        path: 'blog/posts/new',
        loadComponent: () =>
          import('./pages/admin/blog/posts/admin-blog-post-editor').then(
            (module) => module.AdminBlogPostEditor,
          ),
      },
      {
        path: 'blog/posts/:id',
        loadComponent: () =>
          import('./pages/admin/blog/posts/admin-blog-post-editor').then(
            (module) => module.AdminBlogPostEditor,
          ),
      },
      {
        path: 'profile',
        loadComponent: () =>
          import('./pages/admin/profile/admin-profile').then(
            (module) =>
              module.AdminProfile,
          ),
      },
      {
        path: 'users',
        canActivate: [adminGuard],
        loadComponent: () =>
          import('./pages/admin/users/admin-users').then(
            (module) =>
              module.AdminUsers,
          ),
      },
      {
        path: 'blog/categories',
        loadComponent: () =>
          import('./pages/admin/blog/categories/admin-blog-categories').then(
            (module) =>
              module.AdminBlogCategories,
          ),
      },
      {
        path: 'music',
        canActivate: [adminGuard],
        loadComponent: () =>
          import('./pages/admin/music/admin-music').then(
            (module) => module.AdminMusic,
          ),
      },
      {
        path: 'localizations',
        canActivate: [adminGuard],
        loadComponent: () =>
          import('./pages/admin/localizations/admin-localizations').then(
            (module) => module.AdminLocalizations,
          ),
      },
      {
        path: 'music/albums/new',
        canActivate: [adminGuard],
        loadComponent: () =>
          import('./pages/admin/music/albums/admin-album-editor').then(
            (module) => module.AdminAlbumEditor,
          ),
      },
      {
        path: 'music/albums/:id',
        canActivate: [adminGuard],
        loadComponent: () =>
          import('./pages/admin/music/albums/admin-album-editor').then(
            (module) => module.AdminAlbumEditor,
          ),
      },
      {
        path: 'music/tracks/new',
        canActivate: [adminGuard],
        loadComponent: () =>
          import('./pages/admin/music/tracks/admin-track-editor').then(
            (module) => module.AdminTrackEditor,
          ),
      },
      {
        path: 'music/tracks/:id',
        canActivate: [adminGuard],
        loadComponent: () =>
          import('./pages/admin/music/tracks/admin-track-editor').then(
            (module) => module.AdminTrackEditor,
          ),
      },
    ],
  },
];
