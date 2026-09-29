import { DOCUMENT } from '@angular/common';
import { DestroyRef, Injectable, REQUEST, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Meta, Title } from '@angular/platform-browser';
import { ActivatedRouteSnapshot, NavigationEnd, Router } from '@angular/router';
import { Store } from '@ngxs/store';
import { combineLatest, filter, startWith } from 'rxjs';

import type { BlogAuthorPageData, BlogPostPageData } from '../blog/blog-public.service';
import { I18nState } from '../i18n/i18n.state';
import type { Language } from '../i18n/i18n.types';
import type { MusicAlbumPageData } from '../music/music-public.service';
import { SITE_DEFAULT_IMAGE_PATH, SITE_NAME, isIndexableHostname } from './seo.config';

interface StaticSeoCopy {
  title: string;
  description: string;
}

type StaticPageKey =
  | 'home'
  | 'gaming'
  | 'music'
  | 'blog'
  | 'videos'
  | 'community'
  | 'contact'
  | 'support'
  | 'legalNotice'
  | 'privacy';

interface SeoDocument {
  title: string;
  description: string;
  canonicalPath: string;
  language: Language;
  imagePath?: string;
  openGraphType?: 'website' | 'article' | 'music.album' | 'profile';
  indexable?: boolean;
  articlePublishedAt?: string;
  articleAuthor?: string;
  musicReleaseDate?: string | null;
  schema: readonly Record<string, unknown>[];
}

const JSON_LD_SCRIPT_ID = 'mimishow-seo-json-ld';

const STATIC_PATHS = new Map<string, StaticPageKey>([
  ['/', 'home'],
  ['/gaming', 'gaming'],
  ['/music', 'music'],
  ['/blog', 'blog'],
  ['/videos', 'videos'],
  ['/community', 'community'],
  ['/kontakt', 'contact'],
  ['/unterstuetzen', 'support'],
  ['/impressum', 'legalNotice'],
  ['/datenschutz', 'privacy'],
]);

const PRIVATE_PATH_PREFIXES = ['/admin', '/account', '/community/dashboard'] as const;

const STATIC_SEO_COPY: Record<Language, Record<StaticPageKey, StaticSeoCopy>> = {
  de: {
    home: {
      title: 'Mimishow | Musik, Gaming, Livestreams & Community',
      description:
        'Mimis Welt zwischen Musik, Gaming, Livestreams, News und Community. Entdecke aktuelle Streams, eigene Musik und neue Inhalte auf der Mimishow.',
    },
    gaming: {
      title: 'Gaming & Streams | Mimishow',
      description:
        'Entdecke Mimis Gaming-Streams, kommende Sendungen und die Spiele, die aktuell auf der Mimishow im Mittelpunkt stehen.',
    },
    music: {
      title: 'Musik von Mimi | Mimishow',
      description:
        'Mimis eigene Musik, aktuelle Releases, Alben und Geschichten hinter den Songs. Höre Vorschauen und entdecke die Musik der Mimishow.',
    },
    blog: {
      title: 'News & Geschichten | Mimishow',
      description:
        'News, Geschichten und redaktionelle Beiträge aus Mimis Welt und darüber hinaus: Community, Musik, Gaming, LGBTQ+ und weitere Themen.',
    },
    videos: {
      title: 'Videos | Mimishow',
      description:
        'Videos und Highlights aus der Mimishow: Musik, Gaming, Livestreams und weitere Inhalte von Mimi.',
    },
    community: {
      title: 'Community | Mimishow',
      description:
        'Werde Teil von Mimis Community auf Discord und der Mimishow. Entdecke gemeinsame Aktivitäten, Levels, Rollen und Community-Inhalte.',
    },
    contact: {
      title: 'Kontakt | Mimishow',
      description: 'Nimm Kontakt mit Mimi und dem Mimishow-Team auf.',
    },
    support: {
      title: 'Mimi unterstützen | Mimishow',
      description: 'Unterstütze Mimis Musik, Streams und die Weiterentwicklung der Mimishow.',
    },
    legalNotice: {
      title: 'Impressum | Mimishow',
      description: 'Impressum und Anbieterinformationen der Mimishow.',
    },
    privacy: {
      title: 'Datenschutz | Mimishow',
      description:
        'Datenschutzhinweise und Informationen zur Verarbeitung personenbezogener Daten auf der Mimishow.',
    },
  },
  en: {
    home: {
      title: 'Mimishow | Music, gaming, livestreams & community',
      description:
        "Mimi's world of music, gaming, livestreams, news and community. Discover current streams, original music and new content on Mimishow.",
    },
    gaming: {
      title: 'Gaming & streams | Mimishow',
      description:
        "Discover Mimi's gaming streams, upcoming shows and the games currently taking center stage on Mimishow.",
    },
    music: {
      title: 'Music by Mimi | Mimishow',
      description:
        "Mimi's original music, current releases, albums and the stories behind the songs. Listen to previews and discover the music of Mimishow.",
    },
    blog: {
      title: 'News & stories | Mimishow',
      description:
        "News, stories and editorial articles from Mimi's world and beyond, including community, music, gaming, LGBTQ+ topics and more.",
    },
    videos: {
      title: 'Videos | Mimishow',
      description:
        'Videos and highlights from Mimishow, including music, gaming, livestreams and more from Mimi.',
    },
    community: {
      title: 'Community | Mimishow',
      description:
        "Join Mimi's community on Discord and Mimishow. Discover shared activities, levels, roles and community content.",
    },
    contact: {
      title: 'Contact | Mimishow',
      description: 'Get in touch with Mimi and the Mimishow team.',
    },
    support: {
      title: 'Support Mimi | Mimishow',
      description: "Support Mimi's music, streams and the continued development of Mimishow.",
    },
    legalNotice: {
      title: 'Legal notice | Mimishow',
      description: 'Legal notice and provider information for Mimishow.',
    },
    privacy: {
      title: 'Privacy | Mimishow',
      description:
        'Privacy information and details about the processing of personal data on Mimishow.',
    },
  },
};

const SOCIAL_PROFILES = [
  'https://www.twitch.tv/mimimausde',
  'https://www.youtube.com/@Mimis-Show',
  'https://www.instagram.com/mimimaus80/',
  'https://x.com/MimimausDe',
] as const;

@Injectable({
  providedIn: 'root',
})
export class SeoService {
  private readonly destroyRef = inject(DestroyRef);
  private readonly document = inject(DOCUMENT);
  private readonly meta = inject(Meta);
  private readonly request = inject(REQUEST, {
    optional: true,
  });
  private readonly router = inject(Router);
  private readonly store = inject(Store);
  private readonly title = inject(Title);

  private initialized = false;

  initialize(): void {
    if (this.initialized) {
      return;
    }

    this.initialized = true;

    const navigation$ = this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      startWith(null),
    );

    combineLatest([navigation$, this.store.select(I18nState.language)])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(([, language]) => {
        this.updateForCurrentRoute(language);
      });
  }

  private updateForCurrentRoute(language: Language): void {
    const route = this.deepestRouteSnapshot();
    const routePath = route.routeConfig?.path ?? '';
    const canonicalPath = this.currentPath();

    if (routePath === 'blog/:slug') {
      const data = route.data['data'] as BlogPostPageData | undefined;

      if (data) {
        this.applyBlogPost(data);
        return;
      }
    }

    if (routePath === 'blog/autoren/:slug') {
      const data = route.data['data'] as BlogAuthorPageData | undefined;

      if (data) {
        this.applyBlogAuthor(data);
        return;
      }
    }

    if (routePath === 'music/albums/:slug') {
      const data = route.data['data'] as MusicAlbumPageData | undefined;

      if (data) {
        this.applyMusicAlbum(data);
        return;
      }
    }

    if (
      PRIVATE_PATH_PREFIXES.some(
        (prefix) => canonicalPath === prefix || canonicalPath.startsWith(`${prefix}/`),
      )
    ) {
      this.applyPrivatePage(language, canonicalPath);
      return;
    }

    const staticPage = STATIC_PATHS.get(canonicalPath);

    if (staticPage) {
      this.applyStaticPage(staticPage, language, canonicalPath);
      return;
    }

    this.applyUnknownPage(language, canonicalPath);
  }

  private applyStaticPage(page: StaticPageKey, language: Language, canonicalPath: string): void {
    const copy = STATIC_SEO_COPY[language][page];
    const canonicalUrl = this.absoluteUrl(canonicalPath);
    const schema = [
      ...this.baseSchema(language),
      this.webPageSchema(canonicalUrl, copy.title, copy.description, language),
    ];

    if (page === 'blog') {
      schema.push({
        '@type': 'Blog',
        '@id': `${canonicalUrl}#blog`,
        url: canonicalUrl,
        name: copy.title,
        description: copy.description,
        inLanguage: language,
        publisher: {
          '@id': `${this.origin()}/#organization`,
        },
        isPartOf: {
          '@id': `${this.origin()}/#website`,
        },
      });
    }

    if (page !== 'home') {
      schema.push(
        this.breadcrumbSchema([
          this.homeBreadcrumb(language),
          {
            name: this.pageBreadcrumbName(page, language),
            url: canonicalUrl,
          },
        ]),
      );
    }

    this.applyDocument({
      title: copy.title,
      description: copy.description,
      canonicalPath,
      language,
      schema,
    });
  }

  private applyBlogPost(data: BlogPostPageData): void {
    const { post, locale } = data;
    const canonicalPath = `/blog/${encodeURIComponent(post.slug)}`;
    const canonicalUrl = this.absoluteUrl(canonicalPath);
    const description = this.descriptionFrom(post.excerpt || post.contentHtml);
    const imagePath = post.coverAssetId
      ? `/api/assets/${encodeURIComponent(post.coverAssetId)}`
      : SITE_DEFAULT_IMAGE_PATH;
    const imageUrl = this.absoluteUrl(imagePath);
    const authorUrl = this.absoluteUrl(`/blog/autoren/${encodeURIComponent(post.author.slug)}`);
    const title = `${post.title} | ${SITE_NAME}`;

    this.applyDocument({
      title,
      description,
      canonicalPath,
      language: locale,
      imagePath,
      openGraphType: 'article',
      articlePublishedAt: post.publishedAt,
      articleAuthor: authorUrl,
      schema: [
        ...this.baseSchema(locale),
        {
          '@type': 'BlogPosting',
          '@id': `${canonicalUrl}#article`,
          url: canonicalUrl,
          headline: post.title,
          description,
          image: imageUrl,
          datePublished: post.publishedAt,
          inLanguage: locale,
          mainEntityOfPage: {
            '@id': canonicalUrl,
          },
          author: {
            '@type': 'Person',
            name: post.author.displayName,
            url: authorUrl,
          },
          publisher: {
            '@id': `${this.origin()}/#organization`,
          },
          articleSection: post.categories.map((category) => category.name),
          keywords: post.categories.map((category) => category.name).join(', '),
        },
        this.breadcrumbSchema([
          this.homeBreadcrumb(locale),
          {
            name: 'News',
            url: this.absoluteUrl('/blog'),
          },
          {
            name: post.title,
            url: canonicalUrl,
          },
        ]),
      ],
    });
  }

  private applyBlogAuthor(data: BlogAuthorPageData): void {
    const { author } = data.page;
    const { locale } = data;
    const canonicalPath = `/blog/autoren/${encodeURIComponent(author.slug)}`;
    const canonicalUrl = this.absoluteUrl(canonicalPath);
    const description = this.descriptionFrom(
      author.bioHtml,
      locale === 'de'
        ? `Artikel und Beiträge von ${author.displayName} auf der Mimishow.`
        : `Articles and contributions by ${author.displayName} on Mimishow.`,
    );
    const title = `${author.displayName} | ${SITE_NAME}`;

    this.applyDocument({
      title,
      description,
      canonicalPath,
      language: locale,
      openGraphType: 'profile',
      imagePath: author.avatarAssetId
        ? `/api/assets/${encodeURIComponent(author.avatarAssetId)}`
        : SITE_DEFAULT_IMAGE_PATH,
      schema: [
        ...this.baseSchema(locale),
        {
          '@type': 'ProfilePage',
          '@id': `${canonicalUrl}#profile`,
          url: canonicalUrl,
          name: title,
          description,
          inLanguage: locale,
          mainEntity: {
            '@id': `${canonicalUrl}#author`,
          },
          isPartOf: {
            '@id': `${this.origin()}/#website`,
          },
        },
        {
          '@type': 'Person',
          '@id': `${canonicalUrl}#author`,
          name: author.displayName,
          url: canonicalUrl,
          description,
          image: author.avatarAssetId
            ? this.absoluteUrl(`/api/assets/${encodeURIComponent(author.avatarAssetId)}`)
            : undefined,
        },
        this.breadcrumbSchema([
          this.homeBreadcrumb(locale),
          {
            name: 'News',
            url: this.absoluteUrl('/blog'),
          },
          {
            name: author.displayName,
            url: canonicalUrl,
          },
        ]),
      ],
    });
  }

  private applyMusicAlbum(data: MusicAlbumPageData): void {
    const { album, locale } = data;
    const canonicalPath = `/music/albums/${encodeURIComponent(album.slug)}`;
    const canonicalUrl = this.absoluteUrl(canonicalPath);
    const description = this.descriptionFrom(
      album.contentHtml,
      locale === 'de'
        ? `${album.title}: Album von Mimi mit Song-Vorschauen und Hintergrundinformationen auf der Mimishow.`
        : `${album.title}: an album by Mimi with song previews and background information on Mimishow.`,
    );
    const imagePath = album.coverAssetId
      ? `/api/assets/${encodeURIComponent(album.coverAssetId)}`
      : SITE_DEFAULT_IMAGE_PATH;
    const title = `${album.title} | ${SITE_NAME}`;

    this.applyDocument({
      title,
      description,
      canonicalPath,
      language: locale,
      imagePath,
      openGraphType: 'music.album',
      musicReleaseDate: album.releasedAt,
      schema: [
        ...this.baseSchema(locale),
        {
          '@type': 'MusicAlbum',
          '@id': `${canonicalUrl}#album`,
          url: canonicalUrl,
          name: album.title,
          description,
          image: this.absoluteUrl(imagePath),
          datePublished: album.releasedAt ?? undefined,
          inLanguage: locale,
          numTracks: album.tracks.length,
          byArtist: {
            '@id': `${this.origin()}/#mimi`,
          },
          track: album.tracks.map((track) => ({
            '@type': 'MusicRecording',
            name: track.title,
            duration: this.durationToIso(track.durationSeconds),
            byArtist: {
              '@id': `${this.origin()}/#mimi`,
            },
          })),
        },
        this.breadcrumbSchema([
          this.homeBreadcrumb(locale),
          {
            name: locale === 'de' ? 'Musik' : 'Music',
            url: this.absoluteUrl('/music'),
          },
          {
            name: album.title,
            url: canonicalUrl,
          },
        ]),
      ],
    });
  }

  private applyPrivatePage(language: Language, canonicalPath: string): void {
    const fallback = STATIC_SEO_COPY[language].home;

    this.applyDocument({
      title: SITE_NAME,
      description: fallback.description,
      canonicalPath,
      language,
      indexable: false,
      schema: [],
    });
  }

  private applyUnknownPage(language: Language, canonicalPath: string): void {
    const fallback = STATIC_SEO_COPY[language].home;

    this.applyDocument({
      title: SITE_NAME,
      description: fallback.description,
      canonicalPath,
      language,
      indexable: false,
      schema: [],
    });
  }

  private applyDocument(document: SeoDocument): void {
    const origin = this.origin();
    const canonicalUrl = this.absoluteUrl(document.canonicalPath);
    const imageUrl = this.absoluteUrl(document.imagePath ?? SITE_DEFAULT_IMAGE_PATH);
    const indexable = document.indexable !== false && isIndexableHostname(new URL(origin).hostname);
    const robots = indexable
      ? 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1'
      : 'noindex, nofollow';

    this.title.setTitle(document.title);
    this.meta.updateTag({
      name: 'description',
      content: document.description,
    });
    this.meta.updateTag({
      name: 'robots',
      content: robots,
    });

    this.setProperty('og:site_name', SITE_NAME);
    this.setProperty('og:title', document.title);
    this.setProperty('og:description', document.description);
    this.setProperty('og:type', document.openGraphType ?? 'website');
    this.setProperty('og:url', canonicalUrl);
    this.setProperty('og:image', imageUrl);
    this.setProperty('og:image:alt', document.title);
    this.setProperty('og:locale', document.language === 'de' ? 'de_DE' : 'en_US');

    this.meta.updateTag({
      name: 'twitter:card',
      content: 'summary_large_image',
    });
    this.meta.updateTag({
      name: 'twitter:title',
      content: document.title,
    });
    this.meta.updateTag({
      name: 'twitter:description',
      content: document.description,
    });
    this.meta.updateTag({
      name: 'twitter:image',
      content: imageUrl,
    });
    this.meta.updateTag({
      name: 'twitter:image:alt',
      content: document.title,
    });

    this.removeProperty('article:published_time');
    this.removeProperty('article:author');
    this.removeProperty('music:release_date');

    if (document.articlePublishedAt) {
      this.setProperty('article:published_time', document.articlePublishedAt);
    }

    if (document.articleAuthor) {
      this.setProperty('article:author', document.articleAuthor);
    }

    if (document.musicReleaseDate) {
      this.setProperty('music:release_date', document.musicReleaseDate);
    }

    this.setCanonical(canonicalUrl);
    this.setJsonLd(document.schema);
  }

  private baseSchema(language: Language): Record<string, unknown>[] {
    const origin = this.origin();

    return [
      {
        '@type': 'Organization',
        '@id': `${origin}/#organization`,
        name: SITE_NAME,
        url: `${origin}/`,
        logo: {
          '@type': 'ImageObject',
          url: this.absoluteUrl('/images/logo.png'),
        },
      },
      {
        '@type': 'Person',
        '@id': `${origin}/#mimi`,
        name: 'Mimi',
        url: `${origin}/`,
        sameAs: [...SOCIAL_PROFILES],
      },
      {
        '@type': 'WebSite',
        '@id': `${origin}/#website`,
        url: `${origin}/`,
        name: SITE_NAME,
        inLanguage: language,
        publisher: {
          '@id': `${origin}/#organization`,
        },
      },
    ];
  }

  private webPageSchema(
    canonicalUrl: string,
    title: string,
    description: string,
    language: Language,
  ): Record<string, unknown> {
    return {
      '@type': 'WebPage',
      '@id': `${canonicalUrl}#webpage`,
      url: canonicalUrl,
      name: title,
      description,
      inLanguage: language,
      isPartOf: {
        '@id': `${this.origin()}/#website`,
      },
    };
  }

  private breadcrumbSchema(
    items: readonly {
      name: string;
      url: string;
    }[],
  ): Record<string, unknown> {
    return {
      '@type': 'BreadcrumbList',
      itemListElement: items.map((item, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: item.name,
        item: item.url,
      })),
    };
  }

  private homeBreadcrumb(language: Language): {
    name: string;
    url: string;
  } {
    return {
      name: language === 'de' ? 'Startseite' : 'Home',
      url: this.absoluteUrl('/'),
    };
  }

  private pageBreadcrumbName(page: StaticPageKey, language: Language): string {
    const names: Record<Language, Record<StaticPageKey, string>> = {
      de: {
        home: 'Startseite',
        gaming: 'Gaming',
        music: 'Musik',
        blog: 'News',
        videos: 'Videos',
        community: 'Community',
        contact: 'Kontakt',
        support: 'Unterstützen',
        legalNotice: 'Impressum',
        privacy: 'Datenschutz',
      },
      en: {
        home: 'Home',
        gaming: 'Gaming',
        music: 'Music',
        blog: 'News',
        videos: 'Videos',
        community: 'Community',
        contact: 'Contact',
        support: 'Support',
        legalNotice: 'Legal notice',
        privacy: 'Privacy',
      },
    };

    return names[language][page];
  }

  private deepestRouteSnapshot(): ActivatedRouteSnapshot {
    let route = this.router.routerState.snapshot.root;

    while (route.firstChild) {
      route = route.firstChild;
    }

    return route;
  }

  private currentPath(): string {
    const path = this.router.url.split(/[?#]/, 1)[0] ?? '/';

    return path || '/';
  }

  private origin(): string {
    if (this.request) {
      try {
        return new URL(this.request.url).origin;
      } catch {
        // Fall back to the document location below.
      }
    }

    const origin = this.document.location?.origin;

    if (origin && origin !== 'null') {
      return origin;
    }

    return 'https://mimishow.de';
  }

  private absoluteUrl(path: string): string {
    return new URL(path, `${this.origin()}/`).toString();
  }

  private descriptionFrom(value: string, fallback = ''): string {
    const text = this.plainText(value) || fallback;

    if (text.length <= 160) {
      return text;
    }

    return `${text.slice(0, 156).trimEnd()}…`;
  }

  private plainText(value: string): string {
    return value
      .replace(/<[^>]*>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/\s+/g, ' ')
      .trim();
  }

  private durationToIso(seconds: number): string {
    const safeSeconds = Math.max(0, Math.round(seconds));
    const minutes = Math.floor(safeSeconds / 60);
    const remainingSeconds = safeSeconds % 60;

    return `PT${minutes}M${remainingSeconds}S`;
  }

  private setProperty(property: string, content: string): void {
    this.meta.updateTag(
      {
        property,
        content,
      },
      `property='${property}'`,
    );
  }

  private removeProperty(property: string): void {
    this.meta.removeTag(`property='${property}'`);
  }

  private setCanonical(url: string): void {
    let canonical = this.document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');

    if (!canonical) {
      canonical = this.document.createElement('link');
      canonical.rel = 'canonical';
      this.document.head.appendChild(canonical);
    }

    canonical.href = url;
  }

  private setJsonLd(schema: readonly Record<string, unknown>[]): void {
    const existing = this.document.getElementById(JSON_LD_SCRIPT_ID);

    if (schema.length === 0) {
      existing?.remove();
      return;
    }

    const script = existing ?? this.document.createElement('script');

    script.id = JSON_LD_SCRIPT_ID;
    script.setAttribute('type', 'application/ld+json');
    script.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@graph': schema,
    }).replace(/</g, '\\u003c');

    if (!existing) {
      this.document.head.appendChild(script);
    }
  }
}
