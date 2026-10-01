import { TestBed } from '@angular/core/testing';

import { ConsentService } from './consent.service';

const STORAGE_KEY = 'mimi:privacy-consent';

describe('ConsentService', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('starts without optional consent when no decision is stored', () => {
    const service = TestBed.inject(ConsentService);

    expect(service.state()).toEqual({
      status: 'unknown',
    });
    expect(service.analyticsAllowed()).toBe(false);
    expect(service.visible()).toBe(true);
  });

  it('persists an accept-all decision', () => {
    const service = TestBed.inject(ConsentService);

    service.acceptAll();

    expect(service.analyticsAllowed()).toBe(true);
    expect(service.state()).toEqual({
      status: 'configured',
      preferences: {
        analytics: true,
      },
    });
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')).toEqual({
      version: 1,
      preferences: {
        analytics: true,
      },
    });
  });

  it('persists a rejection of optional services', () => {
    const service = TestBed.inject(ConsentService);

    service.rejectOptional();

    expect(service.analyticsAllowed()).toBe(false);
    expect(service.visible()).toBe(false);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')).toEqual({
      version: 1,
      preferences: {
        analytics: false,
      },
    });
  });

  it('discards consent data from an unsupported version', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 0,
        preferences: {
          analytics: true,
        },
      }),
    );

    const service = TestBed.inject(ConsentService);

    expect(service.state()).toEqual({
      status: 'unknown',
    });
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('allows configured users to reopen and close the settings', () => {
    const service = TestBed.inject(ConsentService);

    service.rejectOptional();
    service.openSettings();

    expect(service.settingsOpen()).toBe(true);
    expect(service.visible()).toBe(true);

    service.closeSettings();

    expect(service.settingsOpen()).toBe(false);
    expect(service.visible()).toBe(false);
  });
});
