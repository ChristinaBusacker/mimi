import { Injectable, computed, inject, signal } from '@angular/core';

import { LocalStorageService } from '../storage/local-storage.service';
import {
  CONSENT_VERSION,
  type ConsentPreferences,
  type ConsentState,
  type StoredConsent,
} from './consent.types';

const CONSENT_STORAGE_KEY = 'privacy-consent';
const DEFAULT_PREFERENCES: ConsentPreferences = {
  analytics: false,
};

@Injectable({
  providedIn: 'root',
})
export class ConsentService {
  private readonly storage = inject(LocalStorageService);
  private readonly stateSignal = signal<ConsentState>(this.load());
  private readonly settingsOpenSignal = signal(false);

  readonly state = this.stateSignal.asReadonly();
  readonly settingsOpen = this.settingsOpenSignal.asReadonly();

  readonly visible = computed(
    () => this.stateSignal().status === 'unknown' || this.settingsOpenSignal(),
  );

  readonly analyticsAllowed = computed(() => {
    const state = this.stateSignal();

    return state.status === 'configured' && state.preferences.analytics;
  });

  acceptAll(): void {
    this.persist({
      analytics: true,
    });
  }

  rejectOptional(): void {
    this.persist(DEFAULT_PREFERENCES);
  }

  update(preferences: ConsentPreferences): void {
    this.persist(preferences);
  }

  openSettings(): void {
    this.settingsOpenSignal.set(true);
  }

  closeSettings(): void {
    if (this.stateSignal().status === 'configured') {
      this.settingsOpenSignal.set(false);
    }
  }

  currentPreferences(): ConsentPreferences {
    const state = this.stateSignal();

    return state.status === 'configured'
      ? { ...state.preferences }
      : { ...DEFAULT_PREFERENCES };
  }

  private load(): ConsentState {
    const stored = this.storage.get<unknown>(CONSENT_STORAGE_KEY);

    if (stored === null) {
      return {
        status: 'unknown',
      };
    }

    if (!this.isStoredConsent(stored)) {
      this.storage.remove(CONSENT_STORAGE_KEY);

      return {
        status: 'unknown',
      };
    }

    return {
      status: 'configured',
      preferences: {
        analytics: stored.preferences.analytics,
      },
    };
  }

  private persist(preferences: ConsentPreferences): void {
    const stored: StoredConsent = {
      version: CONSENT_VERSION,
      preferences: {
        analytics: preferences.analytics,
      },
    };

    this.storage.set(CONSENT_STORAGE_KEY, stored);
    this.stateSignal.set({
      status: 'configured',
      preferences: stored.preferences,
    });
    this.settingsOpenSignal.set(false);
  }

  private isStoredConsent(value: unknown): value is StoredConsent {
    if (!this.isRecord(value) || value['version'] !== CONSENT_VERSION) {
      return false;
    }

    const preferences = value['preferences'];

    return this.isRecord(preferences) && typeof preferences['analytics'] === 'boolean';
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
  }
}
