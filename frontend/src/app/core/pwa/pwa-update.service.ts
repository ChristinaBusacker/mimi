import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import {
  DestroyRef,
  Injectable,
  Injector,
  NgZone,
  PLATFORM_ID,
  afterNextRender,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SwUpdate } from '@angular/service-worker';
import { filter, fromEvent, interval, merge } from 'rxjs';

const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;
const MIN_CHECK_SPACING_MS = 60 * 1000;

@Injectable({ providedIn: 'root' })
export class PwaUpdateService {
  private readonly updates = inject(SwUpdate);
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly zone = inject(NgZone);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private readonly readyHash = signal<string | null>(null);
  private readonly dismissedHash = signal<string | null>(null);
  private readonly needsRecovery = signal(false);
  private readonly recoveryDismissed = signal(false);

  readonly recoveryRequired = this.needsRecovery.asReadonly();
  readonly updateAvailable = computed(
    () =>
      (this.readyHash() !== null && this.readyHash() !== this.dismissedHash()) ||
      (this.needsRecovery() && !this.recoveryDismissed()),
  );

  private serviceWorkerReady = false;
  private checkInProgress = false;
  private lastCheckAt = 0;

  constructor() {
    if (!this.isBrowser || !this.updates.isEnabled) {
      return;
    }

    this.updates.versionUpdates
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => {
        if (event.type === 'VERSION_READY') {
          this.zone.run(() => this.readyHash.set(event.latestVersion.hash));
        } else if (event.type === 'VERSION_INSTALLATION_FAILED') {
          console.warn('Could not install the latest Mimishow version:', event.error);
        }
      });

    this.updates.unrecoverable
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => {
        console.warn('The current Mimishow version could not be recovered:', event.reason);
        this.zone.run(() => this.needsRecovery.set(true));
      });

    afterNextRender({ read: () => this.startChecking() }, { injector: this.injector });
  }

  dismiss(): void {
    this.dismissedHash.set(this.readyHash());
    this.recoveryDismissed.set(true);
  }

  reload(): void {
    // A full reload loads a consistent set of versioned chunks; do not call activateUpdate().
    this.document.defaultView?.location.reload();
  }

  private startChecking(): void {
    const window = this.document.defaultView;
    if (!window?.navigator.serviceWorker) {
      return;
    }

    // A newly registered worker can take up to 30 seconds to become ready.
    void window.navigator.serviceWorker.ready
      .then(() => {
        if (this.destroyRef.destroyed) {
          return;
        }

        this.serviceWorkerReady = true;
        void this.checkForUpdate();
      })
      .catch((error: unknown) => {
        console.warn('Mimishow service worker did not become ready:', error);
      });

    this.zone.runOutsideAngular(() => {
      merge(
        fromEvent(this.document, 'visibilitychange').pipe(
          filter(() => this.document.visibilityState === 'visible'),
        ),
        fromEvent(window, 'online'),
        interval(UPDATE_CHECK_INTERVAL_MS),
      )
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(() => {
          if (this.document.visibilityState === 'visible') {
            void this.checkForUpdate();
          }
        });
    });
  }

  private async checkForUpdate(): Promise<void> {
    const now = Date.now();
    if (
      !this.serviceWorkerReady ||
      this.checkInProgress ||
      now - this.lastCheckAt < MIN_CHECK_SPACING_MS
    ) {
      return;
    }

    this.checkInProgress = true;
    this.lastCheckAt = now;

    try {
      await this.updates.checkForUpdate();
    } catch (error: unknown) {
      // Retry promptly after the browser comes back online.
      this.lastCheckAt = 0;
      console.warn('Could not check for a Mimishow update:', error);
    } finally {
      this.checkInProgress = false;
    }
  }
}
