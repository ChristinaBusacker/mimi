import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import {
  DestroyRef,
  Injectable,
  Injector,
  PLATFORM_ID,
  effect,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';

import { ConsentService } from '../privacy/consent.service';
import { isIndexableHostname } from '../seo/seo.config';
import {
  GOOGLE_ANALYTICS_CONFIG,
  normalizeGoogleAnalyticsMeasurementId,
} from './google-analytics.config';

const GOOGLE_ANALYTICS_SCRIPT_ID = 'mimishow-google-analytics';
const GOOGLE_ANALYTICS_COOKIE_DOMAIN = 'mimishow.de';

interface GoogleConsentState {
  readonly analytics_storage: 'denied' | 'granted';
  readonly ad_storage: 'denied';
  readonly ad_user_data: 'denied';
  readonly ad_personalization: 'denied';
}

interface GoogleAnalyticsTagConfig {
  readonly send_page_view: false;
  readonly allow_google_signals: false;
  readonly allow_ad_personalization_signals: false;
}

interface GoogleAnalyticsPageView {
  readonly page_title: string;
  readonly page_location: string;
  readonly page_path: string;
}

type GoogleAnalyticsArguments =
  | ['consent', 'default' | 'update', GoogleConsentState]
  | ['js', Date]
  | ['config', string, GoogleAnalyticsTagConfig]
  | ['event', 'page_view', GoogleAnalyticsPageView];

type GoogleAnalyticsFunction = (...args: GoogleAnalyticsArguments) => void;

interface GoogleAnalyticsWindow extends Window {
  dataLayer?: unknown[];
  gtag?: GoogleAnalyticsFunction;
}

const DENIED_CONSENT: GoogleConsentState = {
  analytics_storage: 'denied',
  ad_storage: 'denied',
  ad_user_data: 'denied',
  ad_personalization: 'denied',
};

const GRANTED_ANALYTICS_CONSENT: GoogleConsentState = {
  analytics_storage: 'granted',
  ad_storage: 'denied',
  ad_user_data: 'denied',
  ad_personalization: 'denied',
};

@Injectable({
  providedIn: 'root',
})
export class GoogleAnalyticsService {
  private readonly config = inject(GOOGLE_ANALYTICS_CONFIG);
  private readonly consent = inject(ConsentService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly document = inject(DOCUMENT);
  private readonly injector = inject(Injector);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly router = inject(Router);

  private readonly measurementId = normalizeGoogleAnalyticsMeasurementId(
    this.config.measurementId,
  );

  private enabled = false;
  private initialized = false;
  private lastTrackedPath: string | null = null;
  private tagConfigured = false;

  initialize(): void {
    if (this.initialized || !this.canRun()) {
      return;
    }

    this.initialized = true;

    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => {
        queueMicrotask(() => this.trackCurrentPage());
      });

    effect(
      () => {
        if (this.consent.analyticsAllowed()) {
          this.enable();
          return;
        }

        this.disable();
      },
      {
        injector: this.injector,
      },
    );
  }

  private canRun(): boolean {
    if (!this.isBrowser || this.measurementId === null) {
      return false;
    }

    const window = this.getWindow();

    return window !== null && isIndexableHostname(window.location.hostname);
  }

  private enable(): void {
    const measurementId = this.measurementId;
    const window = this.getWindow();

    if (measurementId === null || window === null || this.enabled) {
      return;
    }

    Reflect.set(window, this.getDisableProperty(measurementId), false);

    const gtag = this.ensureGtag(window);

    if (!this.tagConfigured) {
      gtag('consent', 'default', DENIED_CONSENT);
      gtag('consent', 'update', GRANTED_ANALYTICS_CONSENT);
      gtag('js', new Date());
      gtag('config', measurementId, {
        send_page_view: false,
        allow_google_signals: false,
        allow_ad_personalization_signals: false,
      });

      this.ensureScript(measurementId);
      this.tagConfigured = true;
    } else {
      gtag('consent', 'update', GRANTED_ANALYTICS_CONSENT);
    }

    this.enabled = true;
    this.lastTrackedPath = null;
    queueMicrotask(() => this.trackCurrentPage());
  }

  private disable(): void {
    const measurementId = this.measurementId;
    const window = this.getWindow();

    if (measurementId === null || window === null) {
      return;
    }

    Reflect.set(window, this.getDisableProperty(measurementId), true);

    if (window.gtag) {
      window.gtag('consent', 'update', DENIED_CONSENT);
    }

    this.enabled = false;
    this.lastTrackedPath = null;
    this.clearAnalyticsCookies();
  }

  private trackCurrentPage(): void {
    if (!this.enabled || !this.consent.analyticsAllowed()) {
      return;
    }

    const window = this.getWindow();
    const gtag = window?.gtag;

    if (!window || !gtag) {
      return;
    }

    const pagePath = this.getPagePath(this.router.url);

    if (pagePath === this.lastTrackedPath) {
      return;
    }

    gtag('event', 'page_view', {
      page_title: this.document.title,
      page_location: new URL(pagePath, window.location.origin).href,
      page_path: pagePath,
    });

    this.lastTrackedPath = pagePath;
  }

  private ensureGtag(window: GoogleAnalyticsWindow): GoogleAnalyticsFunction {
    if (window.gtag) {
      return window.gtag;
    }

    const dataLayer = window.dataLayer ?? [];

    window.dataLayer = dataLayer;
    window.gtag = (...args: GoogleAnalyticsArguments): void => {
      dataLayer.push(args);
    };

    return window.gtag;
  }

  private ensureScript(measurementId: string): void {
    if (this.document.getElementById(GOOGLE_ANALYTICS_SCRIPT_ID)) {
      return;
    }

    const script = this.document.createElement('script');

    script.id = GOOGLE_ANALYTICS_SCRIPT_ID;
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;

    this.document.head.append(script);
  }

  private clearAnalyticsCookies(): void {
    const cookieNames = this.document.cookie
      .split(';')
      .map((cookie) => cookie.split('=', 1)[0]?.trim() ?? '')
      .filter((name) => name === '_ga' || name.startsWith('_ga_'));

    for (const name of new Set(cookieNames)) {
      this.expireCookie(name);
      this.expireCookie(name, GOOGLE_ANALYTICS_COOKIE_DOMAIN);
    }
  }

  private expireCookie(name: string, domain?: string): void {
    const domainPart = domain ? `; Domain=${domain}` : '';

    this.document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax; Secure${domainPart}`;
  }

  private getPagePath(url: string): string {
    const separatorIndex = url.search(/[?#]/u);
    const path = separatorIndex === -1 ? url : url.slice(0, separatorIndex);

    if (!path) {
      return '/';
    }

    return path.startsWith('/') ? path : `/${path}`;
  }

  private getDisableProperty(measurementId: string): string {
    return `ga-disable-${measurementId}`;
  }

  private getWindow(): GoogleAnalyticsWindow | null {
    return this.document.defaultView as GoogleAnalyticsWindow | null;
  }
}
