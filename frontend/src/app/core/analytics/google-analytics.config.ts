import { InjectionToken } from '@angular/core';

export interface GoogleAnalyticsConfig {
  readonly measurementId: string | null;
  readonly allowedHosts: readonly string[];
}

export const googleAnalyticsConfig: GoogleAnalyticsConfig = {
  measurementId: 'G-24YVQVL762',
  allowedHosts: ['mimishow.de', 'www.mimishow.de', 'staging.mimishow.de'],
};

export const GOOGLE_ANALYTICS_CONFIG = new InjectionToken<GoogleAnalyticsConfig>(
  'GOOGLE_ANALYTICS_CONFIG',
  {
    providedIn: 'root',
    factory: () => googleAnalyticsConfig,
  },
);

export function normalizeGoogleAnalyticsMeasurementId(value: string | null): string | null {
  const normalized = value?.trim() ?? '';

  return /^G-[A-Z0-9]+$/u.test(normalized) ? normalized : null;
}
