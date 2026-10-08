import { TestBed } from '@angular/core/testing';
import { SwUpdate, type UnrecoverableStateEvent, type VersionEvent } from '@angular/service-worker';
import { Subject } from 'rxjs';

import { PwaUpdateService } from './pwa-update.service';

describe('PwaUpdateService', () => {
  const versionEvents = new Subject<VersionEvent>();
  const unrecoverableEvents = new Subject<UnrecoverableStateEvent>();
  let service: PwaUpdateService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: SwUpdate,
          useValue: {
            isEnabled: true,
            versionUpdates: versionEvents,
            unrecoverable: unrecoverableEvents,
            checkForUpdate: () => Promise.resolve(false),
          },
        },
      ],
    });

    service = TestBed.inject(PwaUpdateService);
  });

  it('shows a downloaded update and allows deferring that version', () => {
    versionEvents.next({
      type: 'VERSION_READY',
      currentVersion: { hash: 'old' },
      latestVersion: { hash: 'new' },
    });

    expect(service.updateAvailable()).toBe(true);
    service.dismiss();
    expect(service.updateAvailable()).toBe(false);

    versionEvents.next({
      type: 'VERSION_READY',
      currentVersion: { hash: 'old' },
      latestVersion: { hash: 'newer' },
    });
    expect(service.updateAvailable()).toBe(true);
  });

  it('shows a recovery warning for an unrecoverable version', () => {
    unrecoverableEvents.next({ type: 'UNRECOVERABLE_STATE', reason: 'Missing chunk' });
    expect(service.recoveryRequired()).toBe(true);
    expect(service.updateAvailable()).toBe(true);
  });
});
