export type SeoLocale = 'de' | 'en';

export type SeoStaticPageKey =
  | 'home'
  | 'about'
  | 'gaming'
  | 'music'
  | 'blog'
  | 'videos'
  | 'community'
  | 'contact'
  | 'support'
  | 'legalNotice'
  | 'privacy';

export interface SeoPageOverride {
  pageKey: SeoStaticPageKey;
  locale: SeoLocale;
  title: string | null;
  description: string | null;
  imageAssetId: string | null;
  imageDescription: string | null;
}

export interface SaveSeoPageOverride {
  pageKey: SeoStaticPageKey;
  locale: SeoLocale;
  title: string | null;
  description: string | null;
  imageAssetId: string | null;
}

export interface SaveSeoPageOverrides {
  pages: SaveSeoPageOverride[];
}
