export const CONSENT_VERSION = 1 as const;

export interface ConsentPreferences {
  readonly analytics: boolean;
}

export interface StoredConsent {
  readonly version: typeof CONSENT_VERSION;
  readonly preferences: ConsentPreferences;
}

export type ConsentState =
  | {
      readonly status: 'unknown';
    }
  | {
      readonly status: 'configured';
      readonly preferences: ConsentPreferences;
    };
