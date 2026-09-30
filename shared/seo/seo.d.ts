export type SeoLocale = 'de' | 'en';

export type SeoStaticPageKey =
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

export interface SeoPageOverride {
  pageKey: SeoStaticPageKey;
  locale: SeoLocale;
  title: string | null;
  description: string | null;
  socialTitle: string | null;
  socialDescription: string | null;
  socialImageAssetId: string | null;
  socialImageAlt: string | null;
}

export interface SaveSeoPageOverrides {
  pages: SeoPageOverride[];
}
