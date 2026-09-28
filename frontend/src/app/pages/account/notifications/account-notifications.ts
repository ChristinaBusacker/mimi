import type {
  NotificationPreferenceSelection,
} from '@shared/notifications/notifications';

import { AsyncPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
} from '@angular/forms';
import {
  firstValueFrom,
} from 'rxjs';

import { Button } from '../../../components/button/button';
import { I18nPipe } from '../../../core/i18n/i18n.pipe';
import {
  NotificationSettingsService,
  PushSetupError,
  type NotificationDeviceState,
} from '../../../core/notifications/notification-settings.service';

@Component({
  changeDetection:
    ChangeDetectionStrategy.OnPush,
  imports: [
    AsyncPipe,
    Button,
    I18nPipe,
    ReactiveFormsModule,
  ],
  selector:
    'app-account-notifications',
  styleUrl:
    './account-notifications.scss',
  templateUrl:
    './account-notifications.html',
})
export class AccountNotifications
  implements OnInit
{
  private readonly notifications =
    inject(
      NotificationSettingsService,
    );

  protected readonly loading =
    signal(true);
  protected readonly savingPreferences =
    signal(false);
  protected readonly deviceBusy =
    signal(false);
  protected readonly deviceState =
    signal<NotificationDeviceState>(
      'unavailable',
    );
  protected readonly errorKey =
    signal<string | null>(null);
  protected readonly successKey =
    signal<string | null>(null);

  protected readonly deviceStatusKey =
    computed(() =>
      `account.notifications.device.status.${this.deviceState()}`,
    );

  protected readonly form =
    new FormGroup({
      streams:
        new FormControl(false, {
          nonNullable: true,
        }),
      music:
        new FormControl(false, {
          nonNullable: true,
        }),
      blog:
        new FormControl(false, {
          nonNullable: true,
        }),
      personal:
        new FormControl(false, {
          nonNullable: true,
        }),
    });

  async ngOnInit():
    Promise<void> {
    await this.load();
  }

  protected async savePreferences():
    Promise<void> {
    if (this.savingPreferences()) {
      return;
    }

    this.savingPreferences.set(true);
    this.errorKey.set(null);
    this.successKey.set(null);

    const selection:
      NotificationPreferenceSelection =
        this.form.getRawValue();

    try {
      const preferences =
        await firstValueFrom(
          this.notifications
            .updatePreferences(
              selection,
            ),
        );

      this.form.setValue({
        streams:
          preferences.streams,
        music:
          preferences.music,
        blog:
          preferences.blog,
        personal:
          preferences.personal,
      });
      this.form.markAsPristine();
      this.successKey.set(
        'account.notifications.saved',
      );
    } catch {
      this.errorKey.set(
        'account.notifications.saveFailed',
      );
    } finally {
      this.savingPreferences.set(
        false,
      );
    }
  }

  protected async enablePush():
    Promise<void> {
    if (this.deviceBusy()) {
      return;
    }

    this.deviceBusy.set(true);
    this.errorKey.set(null);
    this.successKey.set(null);

    try {
      await this.notifications
        .enablePush();
      this.deviceState.set(
        'active',
      );
      this.successKey.set(
        'account.notifications.device.enabled',
      );
    } catch (error: unknown) {
      await this.refreshDeviceState();
      this.errorKey.set(
        this.setupErrorKey(error),
      );
    } finally {
      this.deviceBusy.set(false);
    }
  }

  protected async disablePush():
    Promise<void> {
    if (this.deviceBusy()) {
      return;
    }

    this.deviceBusy.set(true);
    this.errorKey.set(null);
    this.successKey.set(null);

    try {
      await this.notifications
        .disablePush();
      this.deviceState.set(
        'inactive',
      );
      this.successKey.set(
        'account.notifications.device.disabled',
      );
    } catch {
      await this.refreshDeviceState();
      this.errorKey.set(
        'account.notifications.device.disableFailed',
      );
    } finally {
      this.deviceBusy.set(false);
    }
  }

  private async load():
    Promise<void> {
    this.loading.set(true);
    this.errorKey.set(null);

    try {
      const preferences =
        await firstValueFrom(
          this.notifications
            .getPreferences(),
        );

      this.form.setValue({
        streams:
          preferences.streams,
        music:
          preferences.music,
        blog:
          preferences.blog,
        personal:
          preferences.personal,
      });
      this.form.markAsPristine();
    } catch {
      this.errorKey.set(
        'account.notifications.loadFailed',
      );
    }

    await this.refreshDeviceState();
    this.loading.set(false);
  }

  private async refreshDeviceState():
    Promise<void> {
    try {
      this.deviceState.set(
        await this.notifications
          .getDeviceState(),
      );
    } catch {
      this.deviceState.set(
        'unavailable',
      );
    }
  }

  private setupErrorKey(
    error: unknown,
  ): string {
    if (!(error instanceof PushSetupError)) {
      return 'account.notifications.device.enableFailed';
    }

    switch (error.code) {
      case 'blocked':
        return 'account.notifications.device.blockedHelp';
      case 'server-disabled':
        return 'account.notifications.device.serverDisabledHelp';
      case 'unavailable':
        return 'account.notifications.device.unavailableHelp';
      case 'invalid-subscription':
        return 'account.notifications.device.enableFailed';
    }
  }
}
